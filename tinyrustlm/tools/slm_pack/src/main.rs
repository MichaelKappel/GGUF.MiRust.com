//! TinyRustLM `.slm` packing utility.

mod provenance;
mod quant_writer;
mod slm_validate;
mod tensor_writer;
mod tokenizer_writer;
mod trained_source;
mod writer;

use std::env;
use std::fs::File;
use std::io::{self, Write};
use std::path::Path;

use quant_writer::{pack_q4_pair, quantize_q4_block, quantize_q8_row};
use tensor_writer::{
    tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, tiny_fixture_tied_tensors,
    tinylm16_f32_tensors, tinylm16_q4_tensors, tinylm16_q8_tensors, ModelShape, TensorSpec,
    DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use tokenizer_writer::{ByteTokenizerSection, TokenizerSection};
use writer::{align_to_64, write_f32, write_u32, write_u64};

const HEADER_LEN: usize = 108;
const TENSOR_ENTRY_LEN: usize = 64;
const FLAG_TIED_OUTPUT: u32 = 1;

fn main() {
    if let Err(error) = run() {
        eprintln!("tinyrustlm-slm-pack: {error}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let mut args = env::args().skip(1);
    let Some(output) = args.next() else {
        print_usage();
        return Ok(());
    };
    if output == "validate" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate requires an input .slm path",
            ));
        };
        return slm_validate::validate_path(Path::new(&input));
    }
    if output == "manifest" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "manifest requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "manifest requires an output manifest path",
            ));
        };
        let source_kind = args
            .next()
            .unwrap_or_else(|| "deterministic-smoke".to_string());
        return provenance::write_manifest_for_path(
            Path::new(&input),
            Path::new(&manifest),
            &source_kind,
        );
    }
    if output == "validate-manifest" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-manifest requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-manifest requires a manifest path",
            ));
        };
        return provenance::validate_manifest_path(Path::new(&input), Path::new(&manifest));
    }
    if output == "eval-template" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an input manifest path",
            ));
        };
        let Some(eval_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an output evaluation manifest path",
            ));
        };
        let gate = args
            .next()
            .unwrap_or_else(|| "assistant-quality".to_string());
        return provenance::write_eval_template_for_path(
            Path::new(&input),
            Path::new(&manifest),
            Path::new(&eval_manifest),
            &gate,
        );
    }
    if output == "quality-gate" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires an input manifest path",
            ));
        };
        let Some(gate) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires runtime-smoke or assistant-quality",
            ));
        };
        let eval_manifest = args.next();
        return provenance::quality_gate_path(
            Path::new(&input),
            Path::new(&manifest),
            &gate,
            eval_manifest.as_deref().map(Path::new),
        );
    }
    if output == "source-template" {
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "source-template requires an output source directory",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        return trained_source::write_source_template_path(Path::new(&output_dir), &shape_name);
    }
    if output == "validate-source" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-source requires an input source directory",
            ));
        };
        return trained_source::validate_source_path(Path::new(&input_dir));
    }
    if output == "convert-trained" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-trained requires an input source directory",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-trained requires an output .slm path",
            ));
        };
        let output_quantization = args.next().unwrap_or_else(|| "f32".to_string());
        return trained_source::convert_trained_path(
            Path::new(&input_dir),
            Path::new(&output_slm),
            &output_quantization,
        );
    }
    let mode = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
    let (shape, tensors, tokenizer, flags) = match mode.as_str() {
        "tiny-fixture" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-tied" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tied_tensors(),
            ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        ),
        "tiny-fixture-q8" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-q4" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors_with_dtype(DTYPE_Q4_0),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-bpe" => {
            let shape = ModelShape {
                vocab_size: 262,
                ..ModelShape::tiny_fixture()
            };
            let tensors = tensor_writer::tensors_for_shape(&shape, DTYPE_F32);
            (shape, tensors, TokenizerSection::tiny_bpe_demo(), 0)
        }
        "tinylm16-f32" => (
            ModelShape::tinylm16(),
            tinylm16_f32_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tinylm16-q8" => (
            ModelShape::tinylm16(),
            tinylm16_q8_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tinylm16-q4" => (
            ModelShape::tinylm16(),
            tinylm16_q4_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "supported modes: tiny-fixture, tiny-fixture-tied, tiny-fixture-q8, tiny-fixture-q4, tiny-fixture-bpe, tinylm16-f32, tinylm16-q8, tinylm16-q4",
            ));
        }
    };
    let bytes = if flags == 0 {
        build_model_file(&shape, &tensors, &tokenizer)?
    } else {
        build_model_file_with_flags(&shape, &tensors, &tokenizer, flags)?
    };
    let path = Path::new(&output);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = File::create(path)?;
    file.write_all(&bytes)?;
    Ok(())
}

fn print_usage() {
    eprintln!(
        "usage: tinyrustlm-slm-pack <output.slm> [tiny-fixture|tiny-fixture-tied|tiny-fixture-q8|tiny-fixture-q4|tiny-fixture-bpe|tinylm16-f32|tinylm16-q8|tinylm16-q4]\n       tinyrustlm-slm-pack validate <input.slm>\n       tinyrustlm-slm-pack manifest <input.slm> <output.manifest> [deterministic-smoke|converted-trained]\n       tinyrustlm-slm-pack validate-manifest <input.slm> <input.manifest>\n       tinyrustlm-slm-pack eval-template <input.slm> <input.manifest> <output.eval> [assistant-quality]\n       tinyrustlm-slm-pack quality-gate <input.slm> <input.manifest> <runtime-smoke|assistant-quality> [input.eval]\n       tinyrustlm-slm-pack source-template <output-source-dir> [tiny-fixture|tiny-fixture-tied|tinylm16|tinylm16-tied]\n       tinyrustlm-slm-pack validate-source <input-source-dir>\n       tinyrustlm-slm-pack convert-trained <input-source-dir> <output.slm> [f32|q8_0|q4_0]"
    );
}

pub(crate) fn build_model_file(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
) -> io::Result<Vec<u8>> {
    build_model_file_with_flags(shape, tensors, tokenizer, 0)
}

pub(crate) fn build_model_file_with_flags(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
    flags: u32,
) -> io::Result<Vec<u8>> {
    let tokenizer_offset = HEADER_LEN as u64;
    let tokenizer_length = tokenizer.bytes.len() as u64;
    let tensor_directory_offset = align_to_64(HEADER_LEN + tokenizer.bytes.len()) as u64;
    let tensor_data_offset =
        align_to_64(tensor_directory_offset as usize + tensors.len() * TENSOR_ENTRY_LEN) as u64;

    let mut tensor_offsets = Vec::with_capacity(tensors.len());
    let mut scale_offsets = Vec::with_capacity(tensors.len());
    let mut cursor = tensor_data_offset as usize;
    for tensor in tensors {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor as u64);
        cursor += tensor.byte_len();
        let scale_len = tensor.scale_byte_len();
        if scale_len > 0 {
            cursor = align_to_64(cursor);
            scale_offsets.push(cursor as u64);
            cursor += scale_len;
        } else {
            scale_offsets.push(0);
        }
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(b"SLM1");
    write_u32(&mut bytes, 4, 1)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, 1)?;
    write_u32(&mut bytes, 16, flags)?;
    write_u32(&mut bytes, 20, shape.vocab_size)?;
    write_u32(&mut bytes, 24, shape.special_token_count)?;
    write_u32(&mut bytes, 28, shape.hidden_size)?;
    write_u32(&mut bytes, 32, shape.layer_count)?;
    write_u32(&mut bytes, 36, shape.head_count)?;
    write_u32(&mut bytes, 40, shape.kv_head_count)?;
    write_u32(&mut bytes, 44, shape.head_dim)?;
    write_u32(&mut bytes, 48, shape.ffn_size)?;
    write_u32(&mut bytes, 52, shape.max_context)?;
    write_f32(&mut bytes, 56, 10000.0)?;
    write_f32(&mut bytes, 60, 0.00001)?;
    write_u64(&mut bytes, 64, tokenizer_offset)?;
    write_u64(&mut bytes, 72, tokenizer_length)?;
    write_u64(&mut bytes, 80, tensor_directory_offset)?;
    write_u32(&mut bytes, 88, tensors.len() as u32)?;
    write_u64(&mut bytes, 92, tensor_data_offset)?;
    write_u64(&mut bytes, 100, 0)?;

    let tokenizer_start = tokenizer_offset as usize;
    bytes[tokenizer_start..tokenizer_start + tokenizer.bytes.len()]
        .copy_from_slice(&tokenizer.bytes);

    for (index, tensor) in tensors.iter().enumerate() {
        let entry = tensor_directory_offset as usize + index * TENSOR_ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.dtype)?;
        write_u32(&mut bytes, entry + 12, tensor.rank)?;
        write_u32(&mut bytes, entry + 16, tensor.dims[0])?;
        write_u32(&mut bytes, entry + 20, tensor.dims[1])?;
        write_u32(&mut bytes, entry + 24, tensor.dims[2])?;
        write_u32(&mut bytes, entry + 28, tensor.dims[3])?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index])?;
        write_u64(&mut bytes, entry + 40, tensor.byte_len() as u64)?;
        write_u64(&mut bytes, entry + 48, scale_offsets[index])?;
        write_u32(&mut bytes, entry + 56, tensor.block_size)?;

        write_tensor_payload(
            &mut bytes,
            tensor,
            tensor_offsets[index],
            scale_offsets[index],
        )?;
    }

    let checksum = simple_checksum(&bytes);
    write_u64(&mut bytes, 100, checksum)?;

    Ok(bytes)
}

pub(crate) fn build_model_file_from_values_with_flags(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
    values: &[Vec<f32>],
    flags: u32,
) -> io::Result<Vec<u8>> {
    if tensors.len() != values.len() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "tensor specs and source value lists must have the same length",
        ));
    }
    for (tensor, tensor_values) in tensors.iter().zip(values.iter()) {
        if tensor.element_count() != tensor_values.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "source tensor value count does not match tensor shape",
            ));
        }
    }

    let tokenizer_offset = HEADER_LEN as u64;
    let tokenizer_length = tokenizer.bytes.len() as u64;
    let tensor_directory_offset = align_to_64(HEADER_LEN + tokenizer.bytes.len()) as u64;
    let tensor_data_offset =
        align_to_64(tensor_directory_offset as usize + tensors.len() * TENSOR_ENTRY_LEN) as u64;

    let mut tensor_offsets = Vec::with_capacity(tensors.len());
    let mut scale_offsets = Vec::with_capacity(tensors.len());
    let mut cursor = tensor_data_offset as usize;
    for tensor in tensors {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor as u64);
        cursor += tensor.byte_len();
        let scale_len = tensor.scale_byte_len();
        if scale_len > 0 {
            cursor = align_to_64(cursor);
            scale_offsets.push(cursor as u64);
            cursor += scale_len;
        } else {
            scale_offsets.push(0);
        }
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(b"SLM1");
    write_u32(&mut bytes, 4, 1)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, 1)?;
    write_u32(&mut bytes, 16, flags)?;
    write_u32(&mut bytes, 20, shape.vocab_size)?;
    write_u32(&mut bytes, 24, shape.special_token_count)?;
    write_u32(&mut bytes, 28, shape.hidden_size)?;
    write_u32(&mut bytes, 32, shape.layer_count)?;
    write_u32(&mut bytes, 36, shape.head_count)?;
    write_u32(&mut bytes, 40, shape.kv_head_count)?;
    write_u32(&mut bytes, 44, shape.head_dim)?;
    write_u32(&mut bytes, 48, shape.ffn_size)?;
    write_u32(&mut bytes, 52, shape.max_context)?;
    write_f32(&mut bytes, 56, 10000.0)?;
    write_f32(&mut bytes, 60, 0.00001)?;
    write_u64(&mut bytes, 64, tokenizer_offset)?;
    write_u64(&mut bytes, 72, tokenizer_length)?;
    write_u64(&mut bytes, 80, tensor_directory_offset)?;
    write_u32(&mut bytes, 88, tensors.len() as u32)?;
    write_u64(&mut bytes, 92, tensor_data_offset)?;
    write_u64(&mut bytes, 100, 0)?;

    let tokenizer_start = tokenizer_offset as usize;
    bytes[tokenizer_start..tokenizer_start + tokenizer.bytes.len()]
        .copy_from_slice(&tokenizer.bytes);

    for (index, tensor) in tensors.iter().enumerate() {
        let entry = tensor_directory_offset as usize + index * TENSOR_ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.dtype)?;
        write_u32(&mut bytes, entry + 12, tensor.rank)?;
        write_u32(&mut bytes, entry + 16, tensor.dims[0])?;
        write_u32(&mut bytes, entry + 20, tensor.dims[1])?;
        write_u32(&mut bytes, entry + 24, tensor.dims[2])?;
        write_u32(&mut bytes, entry + 28, tensor.dims[3])?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index])?;
        write_u64(&mut bytes, entry + 40, tensor.byte_len() as u64)?;
        write_u64(&mut bytes, entry + 48, scale_offsets[index])?;
        write_u32(&mut bytes, entry + 56, tensor.block_size)?;

        write_tensor_payload_from_values(
            &mut bytes,
            tensor,
            &values[index],
            tensor_offsets[index],
            scale_offsets[index],
        )?;
    }

    let checksum = simple_checksum(&bytes);
    write_u64(&mut bytes, 100, checksum)?;

    Ok(bytes)
}

fn simple_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x9e3779b97f4a7c15u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (100..108).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn write_tensor_payload(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    match tensor.dtype {
        DTYPE_F32 => write_f32_tensor(bytes, tensor, tensor_offset),
        DTYPE_Q8_0 => write_q8_tensor(bytes, tensor, tensor_offset, scale_offset),
        DTYPE_Q4_0 => write_q4_tensor(bytes, tensor, tensor_offset, scale_offset),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported tensor dtype",
        )),
    }
}

fn write_f32_tensor(bytes: &mut [u8], tensor: &TensorSpec, tensor_offset: u64) -> io::Result<()> {
    let start = tensor_offset as usize;
    for elem in 0..tensor.element_count() {
        write_f32(bytes, start + elem * 4, fixture_value(tensor, elem))?;
    }
    Ok(())
}

fn write_q8_tensor(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut row_values = vec![0.0; cols];
    let mut quantized = vec![0i8; cols];
    for row in 0..rows {
        for col in 0..cols {
            row_values[col] = fixture_value(tensor, row * cols + col);
        }
        let scale = quantize_q8_row(&row_values, &mut quantized);
        write_f32(bytes, scale_start + row * 4, scale)?;
        for col in 0..cols {
            bytes[start + row * cols + col] = quantized[col] as u8;
        }
    }
    Ok(())
}

fn write_q4_tensor(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || block % 2 != 0 || cols % block != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q4 tensor columns must divide into even blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut block_values = vec![0.0; block];
    let mut quantized = vec![0i8; block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            for col in 0..block {
                block_values[col] = fixture_value(tensor, value_start + col);
            }
            let scale = quantize_q4_block(&block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            let byte_start = start + (row * cols + block_index * block) / 2;
            for pair in 0..(block / 2) {
                bytes[byte_start + pair] =
                    pack_q4_pair(quantized[pair * 2], quantized[pair * 2 + 1]);
            }
        }
    }
    Ok(())
}

pub(crate) fn fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    match tensor.seed {
        1 => 0.125,
        2 | 4 | 5 => 1.0,
        3 => output_fixture_value(tensor, elem),
        6 | 7 | 8 | 9 => square_identity_value(tensor, elem, 0.25),
        10 | 12 => 0.0625,
        11 => 0.0625,
        13 => tied_embedding_fixture_value(tensor, elem),
        _ => 0.0,
    }
}

fn write_tensor_payload_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    match tensor.dtype {
        DTYPE_F32 => write_f32_tensor_from_values(bytes, values, tensor_offset),
        DTYPE_Q8_0 => {
            write_q8_tensor_from_values(bytes, tensor, values, tensor_offset, scale_offset)
        }
        DTYPE_Q4_0 => {
            write_q4_tensor_from_values(bytes, tensor, values, tensor_offset, scale_offset)
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported tensor dtype",
        )),
    }
}

fn write_f32_tensor_from_values(
    bytes: &mut [u8],
    values: &[f32],
    tensor_offset: u64,
) -> io::Result<()> {
    let start = tensor_offset as usize;
    for (elem, value) in values.iter().enumerate() {
        write_f32(bytes, start + elem * 4, *value)?;
    }
    Ok(())
}

fn write_q8_tensor_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut quantized = vec![0i8; cols];
    for row in 0..rows {
        let row_start = row * cols;
        let scale = quantize_q8_row(&values[row_start..row_start + cols], &mut quantized);
        write_f32(bytes, scale_start + row * 4, scale)?;
        for col in 0..cols {
            bytes[start + row * cols + col] = quantized[col] as u8;
        }
    }
    Ok(())
}

fn write_q4_tensor_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || block % 2 != 0 || cols % block != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q4 tensor columns must divide into even blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut quantized = vec![0i8; block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            let block_values = &values[value_start..value_start + block];
            let scale = quantize_q4_block(block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            let byte_start = start + (row * cols + block_index * block) / 2;
            for pair in 0..(block / 2) {
                bytes[byte_start + pair] =
                    pack_q4_pair(quantized[pair * 2], quantized[pair * 2 + 1]);
            }
        }
    }
    Ok(())
}

fn output_fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    let hidden = tensor.dims[1] as usize;
    let row = elem / hidden;
    match row {
        101 => 1.0,
        257 => 0.25,
        _ => -0.01,
    }
}

fn tied_embedding_fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    let hidden = tensor.dims[1] as usize;
    let row = elem / hidden;
    match row {
        101 => 1.0,
        257 => 0.25,
        _ => 0.125,
    }
}

fn square_identity_value(tensor: &TensorSpec, elem: usize, scale: f32) -> f32 {
    let rows = tensor.dims[0] as usize;
    let cols = tensor.dims[1] as usize;
    if rows == cols && elem / cols == elem % cols {
        scale
    } else {
        0.0
    }
}
