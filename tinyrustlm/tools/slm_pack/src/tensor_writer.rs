//! Tensor directory writer inputs.

/// Float32 tensor dtype.
pub const DTYPE_F32: u32 = 1;
/// Q8_0 tensor dtype.
pub const DTYPE_Q8_0: u32 = 2;
/// Q4_0 tensor dtype.
pub const DTYPE_Q4_0: u32 = 3;

/// Model dimensions used to write deterministic `.slm` files.
pub struct ModelShape {
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Number of special tokens.
    pub special_token_count: u32,
    /// Transformer hidden size.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value head count.
    pub kv_head_count: u32,
    /// Dimension per attention head.
    pub head_dim: u32,
    /// Feed-forward intermediate size.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
}

impl ModelShape {
    /// Returns the deterministic tiny fixture shape used by unit tests.
    pub fn tiny_fixture() -> Self {
        Self {
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 8,
            layer_count: 1,
            head_count: 2,
            kv_head_count: 2,
            head_dim: 4,
            ffn_size: 16,
            max_context: 16,
        }
    }

    /// Returns the first realistic TinyLM-16M target shape.
    pub fn tinylm16() -> Self {
        Self {
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 512,
            layer_count: 4,
            head_count: 8,
            kv_head_count: 8,
            head_dim: 64,
            ffn_size: 2048,
            max_context: 512,
        }
    }
}

/// Static tensor specification for fixture packing.
pub struct TensorSpec {
    /// Stable tensor name hash.
    pub name_hash: u64,
    /// Tensor dtype.
    pub dtype: u32,
    /// Tensor rank.
    pub rank: u32,
    /// Tensor dimensions.
    pub dims: [u32; 4],
    /// Deterministic fill seed.
    pub seed: u32,
    /// Quantization block size, or zero for f32.
    pub block_size: u32,
}

impl TensorSpec {
    /// Creates a f32 tensor specification.
    pub fn f32(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut padded = [1u32; 4];
        for (index, dim) in dims.iter().enumerate() {
            padded[index] = *dim;
        }
        Self {
            name_hash: name_hash(name),
            dtype: DTYPE_F32,
            rank: dims.len() as u32,
            dims: padded,
            seed,
            block_size: 0,
        }
    }

    /// Creates a q8_0 tensor specification.
    pub fn q8(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut spec = Self::f32(name, dims, seed);
        spec.dtype = DTYPE_Q8_0;
        spec.block_size = spec.cols_per_row() as u32;
        spec
    }

    /// Creates a q4_0 tensor specification.
    pub fn q4(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut spec = Self::f32(name, dims, seed);
        spec.dtype = DTYPE_Q4_0;
        let cols = spec.cols_per_row();
        spec.block_size = if cols >= 32 && cols.is_multiple_of(32) {
            32
        } else {
            cols as u32
        };
        spec
    }

    /// Returns the tensor element count.
    pub fn element_count(&self) -> usize {
        let mut total = 1usize;
        for dim in self.dims.iter().take(self.rank as usize) {
            total *= *dim as usize;
        }
        total
    }

    /// Returns the serialized tensor data byte length.
    pub fn byte_len(&self) -> usize {
        match self.dtype {
            DTYPE_F32 => self.element_count() * 4,
            DTYPE_Q8_0 => self.element_count(),
            DTYPE_Q4_0 => self.element_count() / 2,
            _ => 0,
        }
    }

    /// Returns the serialized quantization scale byte length.
    pub fn scale_byte_len(&self) -> usize {
        match self.dtype {
            DTYPE_Q8_0 => self.rows() * 4,
            DTYPE_Q4_0 => self.rows() * self.blocks_per_row() * 4,
            _ => 0,
        }
    }

    /// Returns row count for row-wise quantization.
    pub fn rows(&self) -> usize {
        if self.rank <= 1 {
            1
        } else {
            self.dims[0] as usize
        }
    }

    /// Returns columns per row for row-wise quantization.
    pub fn cols_per_row(&self) -> usize {
        if self.rank <= 1 {
            self.element_count()
        } else {
            self.dims
                .iter()
                .skip(1)
                .take(self.rank as usize - 1)
                .fold(1usize, |acc, dim| acc * *dim as usize)
        }
    }

    /// Returns q4 blocks per row.
    pub fn blocks_per_row(&self) -> usize {
        let block = self.block_size as usize;
        self.cols_per_row().checked_div(block).unwrap_or(0)
    }
}

/// Returns tensor specs for the tiny test model.
pub fn tiny_fixture_tensors() -> Vec<TensorSpec> {
    tiny_fixture_tensors_with_dtype(DTYPE_F32)
}

/// Returns tensor specs for a quantization-specific tiny test model.
pub fn tiny_fixture_tensors_with_dtype(dtype: u32) -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tiny_fixture(), dtype)
}

/// Returns f32 tensor specs for a tiny tied-output test model.
pub fn tiny_fixture_tied_tensors() -> Vec<TensorSpec> {
    tensors_for_shape_with_tied_output(&ModelShape::tiny_fixture(), DTYPE_F32)
}

/// Returns tensor specs for the TinyLM-16M f32 target model.
pub fn tinylm16_f32_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_F32)
}

/// Returns tensor specs for the TinyLM-16M q8_0 target model.
pub fn tinylm16_q8_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_Q8_0)
}

/// Returns tensor specs for the TinyLM-16M q4_0 target model.
pub fn tinylm16_q4_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_Q4_0)
}

/// Returns tensor specs for a model shape and dtype.
pub fn tensors_for_shape(shape: &ModelShape, dtype: u32) -> Vec<TensorSpec> {
    let hidden = shape.hidden_size;
    let ffn = shape.ffn_size;
    let vocab = shape.vocab_size;
    let mut tensors = vec![
        tensor_spec(dtype, "tok_embeddings.weight", &[vocab, hidden], 1),
        tensor_spec(dtype, "norm.weight", &[hidden], 2),
        tensor_spec(dtype, "output.weight", &[vocab, hidden], 3),
    ];
    for layer in 0..shape.layer_count {
        let prefix = format!("layers.{layer}");
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.attention_norm.weight"),
            &[hidden],
            4,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.ffn_norm.weight"),
            &[hidden],
            5,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wq.weight"),
            &[hidden, hidden],
            6,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wk.weight"),
            &[hidden, hidden],
            7,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wv.weight"),
            &[hidden, hidden],
            8,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wo.weight"),
            &[hidden, hidden],
            9,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w1.weight"),
            &[ffn, hidden],
            10,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w2.weight"),
            &[hidden, ffn],
            11,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w3.weight"),
            &[ffn, hidden],
            12,
        ));
    }
    tensors
}

/// Returns tensor specs for a model shape using tied output projection.
pub fn tensors_for_shape_with_tied_output(shape: &ModelShape, dtype: u32) -> Vec<TensorSpec> {
    let output_hash = name_hash("output.weight");
    let mut tensors = tensors_for_shape(shape, dtype);
    for tensor in &mut tensors {
        if tensor.name_hash == name_hash("tok_embeddings.weight") {
            tensor.seed = 13;
        }
    }
    tensors.retain(|tensor| tensor.name_hash != output_hash);
    tensors
}

fn tensor_spec(dtype: u32, name: &str, dims: &[u32], seed: u32) -> TensorSpec {
    match dtype {
        DTYPE_Q8_0 => TensorSpec::q8(name, dims, seed),
        DTYPE_Q4_0 => TensorSpec::q4(name, dims, seed),
        _ => TensorSpec::f32(name, dims, seed),
    }
}

/// Computes the stable FNV-1a hash used for tensor names.
pub fn name_hash(name: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in name.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
