#![forbid(unsafe_code)]
#![doc = "Public `.slm` validation, inspection, and safe-loading boundary."]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::{Display, Formatter};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tinyrustlm_runtime::errors::ErrorCode;
use tinyrustlm_runtime::model_format::{parse_slm, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0, SLM_MAGIC};

/// Maximum model size accepted by the public safe loader by default.
pub const DEFAULT_MAX_SLM_BYTES: u64 = 512 * 1024 * 1024;

/// Public inspection report for an `.slm` artifact.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SlmInspection {
    /// Stable SDK schema kind.
    pub kind: String,
    /// Stable SDK schema version.
    pub version: u32,
    /// Hex-encoded SHA-256 of the exact artifact bytes.
    pub sha256: String,
    /// Artifact byte length.
    pub byte_count: u64,
    /// `.slm` format version.
    pub slm_version: u32,
    /// Model type identifier from the header.
    pub model_type: u32,
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Transformer hidden width.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value attention head count.
    pub kv_head_count: u32,
    /// Per-head dimension.
    pub head_dim: u32,
    /// Feed-forward intermediate width.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
    /// Tokenizer section byte length.
    pub tokenizer_bytes: u64,
    /// Tensor directory entry count.
    pub tensor_count: u32,
    /// Count of f32 tensors.
    pub f32_tensor_count: u32,
    /// Count of q8_0 tensors.
    pub q8_0_tensor_count: u32,
    /// Count of q4_0 tensors.
    pub q4_0_tensor_count: u32,
    /// Human-readable quantization summary.
    pub quantization: String,
    /// Runtime checksum embedded in the `.slm` header.
    pub runtime_checksum: u64,
}

/// Public safe-loading policy for `.slm` artifacts.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SlmLoadPolicy {
    /// Maximum accepted file size.
    pub max_bytes: u64,
    /// When set, the artifact SHA-256 must match exactly.
    pub expected_sha256: Option<String>,
}

impl Default for SlmLoadPolicy {
    fn default() -> Self {
        Self {
            max_bytes: DEFAULT_MAX_SLM_BYTES,
            expected_sha256: None,
        }
    }
}

/// A safely loaded `.slm` artifact plus its inspection report.
#[derive(Clone, Debug)]
pub struct SafeLoadedSlm {
    path: PathBuf,
    inspection: SlmInspection,
    bytes: Arc<[u8]>,
}

impl SafeLoadedSlm {
    /// Returns the loaded artifact path.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Returns the inspection report proven while loading.
    pub fn inspection(&self) -> &SlmInspection {
        &self.inspection
    }

    /// Returns the validated `.slm` bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }
}

/// Error returned by public `.slm` SDK operations.
#[derive(Debug)]
pub enum SlmError {
    /// File-system access failed.
    Io(String),
    /// The artifact exceeded the configured safe-loading byte budget.
    TooLarge {
        /// Actual artifact byte length.
        byte_count: u64,
        /// Configured maximum byte length.
        max_bytes: u64,
    },
    /// The artifact bytes did not parse as a supported `.slm`.
    InvalidModel(String),
    /// The computed SHA-256 did not match the caller's expected value.
    Sha256Mismatch {
        /// Expected caller-provided SHA-256.
        expected: String,
        /// Actual computed SHA-256.
        actual: String,
    },
}

impl Display for SlmError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(message) => write!(formatter, "I/O error: {message}"),
            Self::TooLarge {
                byte_count,
                max_bytes,
            } => write!(
                formatter,
                ".slm artifact is {byte_count} bytes, above policy limit {max_bytes}"
            ),
            Self::InvalidModel(message) => write!(formatter, "invalid .slm artifact: {message}"),
            Self::Sha256Mismatch { expected, actual } => write!(
                formatter,
                ".slm SHA-256 mismatch: expected {expected}, actual {actual}"
            ),
        }
    }
}

impl std::error::Error for SlmError {}

/// Validates and inspects `.slm` bytes.
pub fn inspect_slm_bytes(bytes: &[u8]) -> Result<SlmInspection, SlmError> {
    if bytes.len() < SLM_MAGIC.len() || bytes[0..4] != SLM_MAGIC {
        return Err(SlmError::InvalidModel(
            ErrorCode::InvalidModelMagic.message().to_string(),
        ));
    }
    let parsed =
        parse_slm(bytes).map_err(|error| SlmError::InvalidModel(error.message().to_string()))?;
    let mut f32_tensor_count = 0u32;
    let mut q8_0_tensor_count = 0u32;
    let mut q4_0_tensor_count = 0u32;
    for tensor in &parsed.tensors {
        match tensor.dtype {
            DTYPE_F32 => f32_tensor_count += 1,
            DTYPE_Q8_0 => q8_0_tensor_count += 1,
            DTYPE_Q4_0 => q4_0_tensor_count += 1,
            other => {
                return Err(SlmError::InvalidModel(format!(
                    "unsupported tensor dtype {other}"
                )))
            }
        }
    }
    let quantization = quantization_summary(f32_tensor_count, q8_0_tensor_count, q4_0_tensor_count);
    let header = parsed.header;
    Ok(SlmInspection {
        kind: "tinyrustlm.slm.inspection.v0".to_string(),
        version: 1,
        sha256: sha256_bytes(bytes),
        byte_count: bytes.len() as u64,
        slm_version: header.version,
        model_type: header.model_type,
        vocab_size: header.vocab_size,
        hidden_size: header.hidden_size,
        layer_count: header.layer_count,
        head_count: header.head_count,
        kv_head_count: header.kv_head_count,
        head_dim: header.head_dim,
        ffn_size: header.ffn_size,
        max_context: header.max_context,
        tokenizer_bytes: header.tokenizer_length,
        tensor_count: header.tensor_count,
        f32_tensor_count,
        q8_0_tensor_count,
        q4_0_tensor_count,
        quantization,
        runtime_checksum: header.checksum,
    })
}

/// Returns whether the byte slice is a valid supported `.slm` artifact.
pub fn validate_slm_bytes(bytes: &[u8]) -> bool {
    inspect_slm_bytes(bytes).is_ok()
}

/// Safely loads a `.slm` file from disk and validates it before returning bytes.
pub fn safe_load_slm_from_path(
    path: impl AsRef<Path>,
    policy: &SlmLoadPolicy,
) -> Result<SafeLoadedSlm, SlmError> {
    let path = path.as_ref();
    let metadata = fs::metadata(path).map_err(|error| SlmError::Io(error.to_string()))?;
    let byte_count = metadata.len();
    if byte_count > policy.max_bytes {
        return Err(SlmError::TooLarge {
            byte_count,
            max_bytes: policy.max_bytes,
        });
    }
    let bytes = fs::read(path).map_err(|error| SlmError::Io(error.to_string()))?;
    let inspection = inspect_slm_bytes(&bytes)?;
    if let Some(expected) = policy.expected_sha256.as_deref() {
        if !expected.eq_ignore_ascii_case(&inspection.sha256) {
            return Err(SlmError::Sha256Mismatch {
                expected: expected.to_string(),
                actual: inspection.sha256.clone(),
            });
        }
    }
    Ok(SafeLoadedSlm {
        path: path.to_path_buf(),
        inspection,
        bytes: Arc::from(bytes.into_boxed_slice()),
    })
}

/// Inspects a `.slm` file from disk with the default safe-loading byte budget.
pub fn inspect_slm_path(path: impl AsRef<Path>) -> Result<SlmInspection, SlmError> {
    safe_load_slm_from_path(path, &SlmLoadPolicy::default()).map(|loaded| loaded.inspection)
}

fn quantization_summary(f32_count: u32, q8_count: u32, q4_count: u32) -> String {
    match (f32_count > 0, q8_count > 0, q4_count > 0) {
        (true, false, false) => "f32".to_string(),
        (false, true, false) => "q8_0".to_string(),
        (false, false, true) => "q4_0".to_string(),
        (true, true, false) => "mixed-f32-q8_0".to_string(),
        (true, false, true) => "mixed-f32-q4_0".to_string(),
        (false, true, true) => "mixed-q8_0-q4_0".to_string(),
        (true, true, true) => "mixed-f32-q8_0-q4_0".to_string(),
        (false, false, false) => "empty".to_string(),
    }
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("sha256:{}", hex_lower(&hasher.finalize()))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use tinyrustlm_runtime::model_format::SLM_VERSION;

    fn fixture_model() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.slm")
    }

    #[test]
    fn inspects_fixture_model() {
        let report = inspect_slm_path(fixture_model()).expect("inspection");
        assert_eq!(report.kind, "tinyrustlm.slm.inspection.v0");
        assert_eq!(report.version, 1);
        assert_eq!(report.slm_version, SLM_VERSION);
        assert!(report.byte_count > 0);
        assert!(report.sha256.starts_with("sha256:"));
        assert!(report.tensor_count > 0);
        assert_eq!(report.quantization, "f32");
    }

    #[test]
    fn rejects_sha256_drift() {
        let path = fixture_model();
        let policy = SlmLoadPolicy {
            expected_sha256: Some(format!("sha256:{}", "0".repeat(64))),
            ..SlmLoadPolicy::default()
        };
        let error = safe_load_slm_from_path(path, &policy).expect_err("sha mismatch");
        assert!(error.to_string().contains("SHA-256 mismatch"));
    }

    #[test]
    fn rejects_invalid_magic() {
        let error = inspect_slm_bytes(b"not an slm").expect_err("invalid");
        assert!(error.to_string().contains("invalid model magic"));
    }
}
