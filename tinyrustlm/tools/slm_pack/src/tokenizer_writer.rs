//! Tokenizer section writer.

/// Tokenizer section bytes.
pub struct TokenizerSection {
    /// Serialized tokenizer metadata.
    pub bytes: Vec<u8>,
}

/// Compatibility alias for the phase-one byte-tokenizer section.
pub type ByteTokenizerSection = TokenizerSection;

impl TokenizerSection {
    /// Creates a phase-one byte tokenizer metadata section.
    pub fn phase_one() -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BTOK");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&258u32.to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        Self { bytes }
    }

    /// Creates a small deterministic BPE tokenizer metadata section for tests.
    ///
    /// The section uses byte fallback plus two merges: `t` + `h` -> `th`,
    /// then `th` + `e` -> `the`.
    pub fn tiny_bpe_demo() -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BPE1");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&262u32.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&258u32.to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        write_token(&mut bytes, 260, b"th");
        write_token(&mut bytes, 261, b"the");
        write_merge(&mut bytes, 116, 104, 260, 0);
        write_merge(&mut bytes, 260, 101, 261, 1);
        Self { bytes }
    }
}

fn write_token(bytes: &mut Vec<u8>, id: u32, text: &[u8]) {
    bytes.extend_from_slice(&id.to_le_bytes());
    bytes.extend_from_slice(&(text.len() as u32).to_le_bytes());
    bytes.extend_from_slice(text);
}

fn write_merge(bytes: &mut Vec<u8>, left: u32, right: u32, output: u32, rank: u32) {
    bytes.extend_from_slice(&left.to_le_bytes());
    bytes.extend_from_slice(&right.to_le_bytes());
    bytes.extend_from_slice(&output.to_le_bytes());
    bytes.extend_from_slice(&rank.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiny_bpe_demo_writes_self_describing_section() {
        let section = TokenizerSection::tiny_bpe_demo();
        assert_eq!(section.bytes.get(0..4), Some(&b"BPE1"[..]));
        assert!(section.bytes.len() > ByteTokenizerSection::phase_one().bytes.len());
    }
}
