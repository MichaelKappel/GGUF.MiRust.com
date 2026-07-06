# SLM Validation

The NuGet SDK validates `.slm` files through the supported TinyRustLM runtime parser.

Validation checks include:

- `SLM1` magic and supported format version.
- Header length and field sanity.
- Transformer shape consistency.
- Tokenizer and tensor-directory ranges.
- Tensor data ranges and supported dtype values.
- Embedded runtime checksum.
- Optional expected SHA-256 match.
- Default public safe-loading byte budget.

The SDK reports shape, tokenizer bytes, tensor counts, quantization summary, byte count, artifact SHA-256, and runtime checksum. It does not expose `.slm` authoring internals or conversion tools.
