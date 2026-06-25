//! Local tokenizers for TinyRustLM model files.

use crate::errors::ErrorCode;
use std::convert::TryInto;

/// Beginning-of-sequence token.
pub const BOS: u32 = 256;
/// End-of-sequence token.
pub const EOS: u32 = 257;
/// Padding token.
pub const PAD: u32 = 258;
/// Unknown token.
pub const UNK: u32 = 259;
/// Vocabulary size for phase-one byte tokenization.
pub const BYTE_VOCAB_SIZE: u32 = 260;

/// Tokenizer selected from a loaded `.slm` tokenizer section.
#[derive(Clone, Debug)]
pub enum Tokenizer {
    /// Fixed byte-tokenizer path used by phase-one models.
    Byte(ByteTokenizer),
    /// Custom BPE tokenizer path used by phase-two models.
    Bpe(CustomBpeTokenizer),
}

impl Tokenizer {
    /// Parses a tokenizer section from `.slm` model bytes.
    ///
    /// `section` must point only at the tokenizer payload declared by the
    /// model header. The return value is the runtime tokenizer selected by
    /// the section magic.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        match section.get(0..4) {
            Some(b"BTOK") => {
                ByteTokenizer::validate_section(section)?;
                Ok(Self::Byte(ByteTokenizer::new()))
            }
            Some(b"BPE1") => Ok(Self::Bpe(CustomBpeTokenizer::from_section(section)?)),
            _ => Err(ErrorCode::InvalidHeader),
        }
    }

    /// Encodes UTF-8 text into model token ids.
    ///
    /// `out` is cleared before tokens are written. The return value reports
    /// tokenizer validation or input-size failures.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        match self {
            Self::Byte(tokenizer) => tokenizer.encode(text, out),
            Self::Bpe(tokenizer) => tokenizer.encode(text, out),
        }
    }

    /// Decodes model token ids into UTF-8 text.
    ///
    /// `out` is cleared before decoded text is written. Unknown token ids
    /// outside the tokenizer vocabulary return an explicit error.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        match self {
            Self::Byte(tokenizer) => tokenizer.decode(tokens, out),
            Self::Bpe(tokenizer) => tokenizer.decode(tokens, out),
        }
    }

    /// Returns a compact tokenizer label for diagnostics and tests.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Byte(_) => "byte-v1",
            Self::Bpe(_) => "bpe-v1",
        }
    }
}

impl Default for Tokenizer {
    fn default() -> Self {
        Self::Byte(ByteTokenizer::new())
    }
}

/// Phase-one byte tokenizer.
#[derive(Clone, Copy, Debug, Default)]
pub struct ByteTokenizer;

impl ByteTokenizer {
    /// Creates a new byte tokenizer.
    pub fn new() -> Self {
        Self
    }

    /// Validates a phase-one `BTOK` tokenizer section.
    ///
    /// The return value is `Ok(())` when the section declares the fixed byte
    /// vocabulary and special-token ids used by this runtime.
    pub fn validate_section(section: &[u8]) -> Result<(), ErrorCode> {
        if section.len() < 28 {
            return Err(ErrorCode::InvalidHeader);
        }
        if section.get(0..4) != Some(b"BTOK") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1
            || read_u32(section, 8)? != BYTE_VOCAB_SIZE
            || read_u32(section, 12)? != BOS
            || read_u32(section, 16)? != EOS
            || read_u32(section, 20)? != PAD
            || read_u32(section, 24)? != UNK
        {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(())
    }

    /// Encodes UTF-8 text into byte tokens with BOS and EOS delimiters.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.as_bytes().len() + 2 > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        out.clear();
        out.push(BOS);
        for byte in text.as_bytes() {
            out.push(u32::from(*byte));
        }
        out.push(EOS);
        Ok(())
    }

    /// Decodes byte tokens into UTF-8 text while ignoring BOS, EOS, and PAD.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len());
        for token in tokens {
            match *token {
                0..=255 => bytes.push(*token as u8),
                BOS | EOS | PAD => {}
                UNK => bytes.push(b'?'),
                _ => return Err(ErrorCode::InvalidLength),
            }
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        out.clear();
        out.push_str(text);
        Ok(())
    }
}

/// Custom phase-two BPE tokenizer with byte fallback.
#[derive(Clone, Debug)]
pub struct CustomBpeTokenizer {
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    tokens: Vec<BpeToken>,
    merges: Vec<BpeMerge>,
}

#[derive(Clone, Debug)]
struct BpeToken {
    id: u32,
    bytes: Vec<u8>,
}

#[derive(Clone, Copy, Debug)]
struct BpeMerge {
    left: u32,
    right: u32,
    output: u32,
    rank: u32,
}

impl CustomBpeTokenizer {
    /// Parses a custom `BPE1` tokenizer section.
    ///
    /// The format is little-endian and self-contained: header, variable
    /// token table, and fixed merge table. The return value is a tokenizer
    /// with byte fallback and deterministic ranked merges.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        if section.len() < 36 || section.get(0..4) != Some(b"BPE1") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1 {
            return Err(ErrorCode::UnsupportedModelVersion);
        }
        let vocab_size = read_u32(section, 8)?;
        let bos = read_u32(section, 12)?;
        let eos = read_u32(section, 16)?;
        let pad = read_u32(section, 20)?;
        let unk = read_u32(section, 24)?;
        let token_count = read_u32(section, 28)? as usize;
        let merge_count = read_u32(section, 32)? as usize;
        if vocab_size < BYTE_VOCAB_SIZE
            || bos >= vocab_size
            || eos >= vocab_size
            || pad >= vocab_size
            || unk >= vocab_size
        {
            return Err(ErrorCode::InvalidHeader);
        }

        let mut offset = 36usize;
        let mut tokens = Vec::with_capacity(token_count);
        for _ in 0..token_count {
            let id = read_u32(section, offset)?;
            let len = read_u32(section, offset + 4)? as usize;
            offset = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
            let end = offset.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
            let bytes = section
                .get(offset..end)
                .ok_or(ErrorCode::InvalidHeader)?
                .to_vec();
            if id < BYTE_VOCAB_SIZE || id >= vocab_size || bytes.is_empty() {
                return Err(ErrorCode::InvalidHeader);
            }
            if tokens.iter().any(|token: &BpeToken| token.id == id) {
                return Err(ErrorCode::InvalidHeader);
            }
            tokens.push(BpeToken { id, bytes });
            offset = end;
        }

        let mut merges = Vec::with_capacity(merge_count);
        for _ in 0..merge_count {
            let end = offset.checked_add(16).ok_or(ErrorCode::InvalidLength)?;
            if end > section.len() {
                return Err(ErrorCode::InvalidHeader);
            }
            let left = read_u32(section, offset)?;
            let right = read_u32(section, offset + 4)?;
            let output = read_u32(section, offset + 8)?;
            let rank = read_u32(section, offset + 12)?;
            if left >= vocab_size
                || right >= vocab_size
                || output >= vocab_size
                || output < BYTE_VOCAB_SIZE
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if !tokens.iter().any(|token| token.id == output) {
                return Err(ErrorCode::InvalidHeader);
            }
            merges.push(BpeMerge {
                left,
                right,
                output,
                rank,
            });
            offset = end;
        }
        if offset != section.len() {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(Self {
            vocab_size,
            bos,
            eos,
            pad,
            unk,
            tokens,
            merges,
        })
    }

    /// Encodes UTF-8 text with byte fallback and ranked BPE merges.
    ///
    /// The output always starts with BOS and ends with EOS when encoding
    /// succeeds.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.as_bytes().len() + 2 > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        let mut merged: Vec<u32> = text
            .as_bytes()
            .iter()
            .map(|byte| u32::from(*byte))
            .collect();
        self.apply_merges(&mut merged);
        out.clear();
        out.reserve(merged.len() + 2);
        out.push(self.bos);
        out.extend_from_slice(&merged);
        out.push(self.eos);
        Ok(())
    }

    /// Decodes byte fallback and token-table ids into UTF-8 text.
    ///
    /// Special tokens are skipped, UNK decodes to `?`, and invalid token ids
    /// return an explicit error.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len());
        for token in tokens {
            if *token == self.bos || *token == self.eos || *token == self.pad {
                continue;
            }
            if *token == self.unk {
                bytes.push(b'?');
                continue;
            }
            match *token {
                0..=255 => bytes.push(*token as u8),
                _ if *token < self.vocab_size => {
                    let Some(entry) = self.tokens.iter().find(|entry| entry.id == *token) else {
                        return Err(ErrorCode::InvalidLength);
                    };
                    bytes.extend_from_slice(&entry.bytes);
                }
                _ => return Err(ErrorCode::InvalidLength),
            }
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        out.clear();
        out.push_str(text);
        Ok(())
    }

    fn apply_merges(&self, tokens: &mut Vec<u32>) {
        loop {
            let Some((index, merge)) = self.best_merge(tokens) else {
                break;
            };
            tokens[index] = merge.output;
            tokens.remove(index + 1);
        }
    }

    fn best_merge(&self, tokens: &[u32]) -> Option<(usize, BpeMerge)> {
        if tokens.len() < 2 {
            return None;
        }
        let mut best: Option<(usize, BpeMerge)> = None;
        for index in 0..tokens.len() - 1 {
            let left = tokens[index];
            let right = tokens[index + 1];
            for merge in &self.merges {
                if merge.left == left && merge.right == right {
                    match best {
                        Some((_, current)) if current.rank <= merge.rank => {}
                        _ => best = Some((index, *merge)),
                    }
                }
            }
        }
        best
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_bpe_section() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BPE1");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&262u32.to_le_bytes());
        bytes.extend_from_slice(&BOS.to_le_bytes());
        bytes.extend_from_slice(&EOS.to_le_bytes());
        bytes.extend_from_slice(&PAD.to_le_bytes());
        bytes.extend_from_slice(&UNK.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(b"th");
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&3u32.to_le_bytes());
        bytes.extend_from_slice(b"the");
        bytes.extend_from_slice(&116u32.to_le_bytes());
        bytes.extend_from_slice(&104u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&101u32.to_le_bytes());
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes
    }

    #[test]
    fn byte_tokenizer_round_trip() {
        let tokenizer = ByteTokenizer::new();
        let mut tokens = Vec::new();
        tokenizer.encode("hello", &mut tokens).unwrap();
        assert_eq!(tokens, [BOS, 104, 101, 108, 108, 111, EOS]);
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "hello");
    }

    #[test]
    fn utf8_prompt_handling() {
        let tokenizer = ByteTokenizer::new();
        let mut tokens = Vec::new();
        tokenizer.encode("local ai", &mut tokens).unwrap();
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "local ai");
    }

    #[test]
    fn custom_bpe_merges_and_decodes() {
        let tokenizer = Tokenizer::from_section(&tiny_bpe_section()).unwrap();
        assert_eq!(tokenizer.label(), "bpe-v1");
        let mut tokens = Vec::new();
        tokenizer.encode("the", &mut tokens).unwrap();
        assert_eq!(tokens, [BOS, 261, EOS]);
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "the");
    }

    #[test]
    fn custom_bpe_rejects_invalid_merge_output() {
        let mut section = tiny_bpe_section();
        let output_offset = section.len() - 8;
        section[output_offset..output_offset + 4].copy_from_slice(&300u32.to_le_bytes());
        assert_eq!(
            Tokenizer::from_section(&section).unwrap_err(),
            ErrorCode::InvalidHeader
        );
    }
}
