# TinyRustLM Models

Static local `.slm` files belong here.

Generate the local model artifacts with:

```powershell
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q8.slm tiny-fixture-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q4.slm tiny-fixture-q4
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-f32.slm tinylm16-f32
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q8.slm tinylm16-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q4.slm tinylm16-q4
```

The packer writes checksum-bearing `.slm` files. Runtime loading rejects zero or mismatched checksums before tensor decoding, so regenerate the artifacts after any format, tensor writer, or checksum change.

Validate any generated or converted `.slm` file before serving it:

```powershell
cargo run -p tinyrustlm-slm-pack -- validate .\tinyrustlm\models\tinylm16-q8.slm
cargo run -p tinyrustlm-slm-pack -- validate-manifest .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest
```

The validator checks the model header, tokenizer metadata, checksum, required tensor names and shapes, dtype-specific byte lengths, finite f32 payload values, and quantization scale ranges. It is an admission gate for model artifacts, not a trained-quality benchmark.

`tiny-test-model-bpe.slm` is the custom-tokenizer runtime fixture. It uses `BPE1`, vocab 262, and the deterministic `the` merge path so runtime diagnostics can prove the model selected BPE and produced tokenizer output `256,261` before generation.

Generate or refresh a provenance sidecar with:

```powershell
cargo run -p tinyrustlm-slm-pack -- manifest .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest deterministic-smoke
```

The sidecar is line-based and keeps model-admission claims honest. Current local artifacts are deterministic smoke models, so their manifests must say `source_kind=deterministic-smoke`, `quality_claim=runtime-execution-smoke-only`, and `trained_quality_claim=not-claimed`. Future converted trained models should use `source_kind=converted-trained`, which validates as structurally accepted but quality-pending until task evaluation and safety review exist.

Validate and convert a raw trained-source fixture with:

```powershell
cargo run -p tinyrustlm-slm-pack -- validate-source .\tinyrustlm\tests\fixtures\trained-source-tiny
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
```

`convert-trained` reads `source.manifest` plus raw f32 tensor files under `tensors/`, rejects unsafe paths, checksum drift, wrong byte counts, wrong shapes, non-finite values, out-of-range weights, and all-zero tensors, then writes a checksum-bearing `.slm` plus a `converted-trained` manifest. `tinyrustlm-eval` executes exact cases through the Rust runtime and writes a scoped eval sidecar. The checked-in eval cases prove only the tiny converted-source fixture scope; they are not a product assistant-quality claim.

Check the explicit quality gate before making a claim about an artifact:

```powershell
cargo run -p tinyrustlm-slm-pack -- quality-gate .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- eval-template .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\tinyrustlm\models\tinylm16-q8.slm.eval assistant-quality
```

`runtime-smoke` proves only local runtime execution. `assistant-quality` requires a converted-trained manifest plus a separate eval sidecar with matching model and manifest checksums, passed task evaluation, passed safety review, a non-placeholder quality scope, and `quality_decision=accepted-for-assistant-quality`. The generated eval template is intentionally `pending` and must fail `assistant-quality` until reviewed evidence replaces the placeholder fields.

Current artifact SHA256 values:

- `tiny-test-model.slm`: `17D79EE766578729D2B69090547E819E011D76115519514E19AC3754DE610A1A`
- `tiny-test-model-q8.slm`: `6AF985853325EAA6D3EAAA8AADD3511DA9596EB542FB2D03A9BC9DC1F4377ADF`
- `tiny-test-model-q4.slm`: `4004E2152F0B6382C6043A15084DE6DC4AE6AE6B6C5BA43ABDE8812ED0174CF6`
- `tiny-test-model-bpe.slm`: `31B27903C1588A1F246281DEF8027094C0D3862635FA7D3761AA1327471F3E82`
- `tinylm16-f32.slm`: `70E9765080247FE859506534E87330D73FF50B66B8A48DC627C307069BB0DC5B`
- `tinylm16-q8.slm`: `C3919E6D7244890E9B3C2B5E40C37F8D322467D859C15B8155700F20408DB950`
- `tinylm16-q4.slm`: `5AC2BD957113732BE9AB2AADFA2D2EFD54C3131E7E6C97BE424FAC6E72BB365B`

Current manifest SHA256 values:

- `tiny-test-model.slm.manifest`: `04A621560A3F24C8E8243A1D085CACB6944CAD0898967582500EDE6D885B1B81`
- `tiny-test-model-q8.slm.manifest`: `85AC07502280F1D05B18A6932B83465C60CA59EE1B4D157A45C668380131294F`
- `tiny-test-model-q4.slm.manifest`: `EB53E4A34D831571BE34B29049D07901E85411561E761DC2C9E37C60827B853F`
- `tiny-test-model-bpe.slm.manifest`: `AE28DDD62E91834A1F7F6D29BE186CB9EA81A92FAEBC0A5AF3E5A4897DC15B52`
- `tinylm16-f32.slm.manifest`: `D9CDEF0D7CE09979EF8D824BCF68555322B89A286DE197148CD2263F654E3010`
- `tinylm16-q8.slm.manifest`: `21178B39642AE045CB26FE99B1595BC5B193AE563EC17F7545E478316CBFAA70`
- `tinylm16-q4.slm.manifest`: `7B1C77776876EC9BE80DD00CEFB6C7AE877FD592FBF4FAD5029080B36B8D46CB`

`tinylm16-f32.slm`, `tinylm16-q8.slm`, and `tinylm16-q4.slm` are deterministic real-shaped smoke models. The q4_0 artifact is 10,657,728 bytes and uses direct q4_0 matrix dispatch in the runtime.
