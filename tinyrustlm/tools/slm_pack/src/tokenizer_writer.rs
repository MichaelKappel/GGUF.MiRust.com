//! Tokenizer section writer.

/// Tokenizer section bytes.
pub struct TokenizerSection {
    /// Serialized tokenizer metadata.
    pub bytes: Vec<u8>,
}

/// One custom BPE token table entry.
pub struct BpeTokenSpec {
    /// Token id, which must be outside the byte fallback range.
    pub id: u32,
    /// UTF-8 bytes or raw byte sequence represented by the token.
    pub bytes: Vec<u8>,
}

/// One ranked custom BPE merge rule.
pub struct BpeMergeSpec {
    /// Left token id.
    pub left: u32,
    /// Right token id.
    pub right: u32,
    /// Output token id.
    pub output: u32,
    /// Lower rank values merge first.
    pub rank: u32,
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
        let tokens = vec![
            BpeTokenSpec {
                id: 260,
                bytes: b"th".to_vec(),
            },
            BpeTokenSpec {
                id: 261,
                bytes: b"the".to_vec(),
            },
        ];
        let merges = vec![
            BpeMergeSpec {
                left: 116,
                right: 104,
                output: 260,
                rank: 0,
            },
            BpeMergeSpec {
                left: 260,
                right: 101,
                output: 261,
                rank: 1,
            },
        ];
        Self::bpe_from_parts(262, &tokens, &merges)
    }

    /// Creates a custom BPE tokenizer metadata section from manifest parts.
    ///
    /// The caller owns semantic validation; this writer serializes the
    /// self-contained `BPE1` section used by both runtime and native
    /// validation.
    pub fn bpe_from_parts(
        vocab_size: u32,
        tokens: &[BpeTokenSpec],
        merges: &[BpeMergeSpec],
    ) -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BPE1");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&vocab_size.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&258u32.to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&(tokens.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(merges.len() as u32).to_le_bytes());
        for token in tokens {
            write_token(&mut bytes, token.id, &token.bytes);
        }
        for merge in merges {
            write_merge(
                &mut bytes,
                merge.left,
                merge.right,
                merge.output,
                merge.rank,
            );
        }
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
