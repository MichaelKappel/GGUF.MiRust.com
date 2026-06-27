# TinyRustLM Models

Static local `.slm` files belong here.

Generate the local model artifacts with:

```powershell
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q8.slm tiny-fixture-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q4.slm tiny-fixture-q4
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-tied.slm tiny-fixture-tied
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

Write a parent compatibility report before using two `.slm` files as a future assembly or model-breeding parent set:

```powershell
cargo run -p tinyrustlm-slm-pack -- compatibility .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-self.compat
cargo run -p tinyrustlm-slm-pack -- compatibility .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q4.slm
cargo run -p tinyrustlm-slm-pack -- lineage-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage tinylm16-q8-self-candidate identity-parent-set browser-local-16m-budget
cargo run -p tinyrustlm-slm-pack -- validate-lineage .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage
cargo run -p tinyrustlm-slm-pack -- blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- validate-blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator 1000000
cargo run -p tinyrustlm-slm-pack -- validate-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator
cargo run -p tinyrustlm-slm-pack -- sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator 1000000 250000
cargo run -p tinyrustlm-slm-pack -- validate-sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator
cargo run -p tinyrustlm-slm-pack -- adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- validate-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- validate-fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- candidate-manifest .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- validate-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- promotion-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion local-smoke-runner browser-local-runtime-smoke-and-eval
cargo run -p tinyrustlm-slm-pack -- validate-promotion .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion
cargo run -p tinyrustlm-slm-pack -- manifest .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest deterministic-smoke
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest .\target\model-breeding\tinylm16-q8-blend.runtime
cargo run -p tinyrustlm-slm-pack -- validate-runtime-smoke .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest .\target\model-breeding\tinylm16-q8-blend.runtime
```

The report records each parent checksum, model shape, tokenizer checksum, tensor layout checksum, quantization label, and output-head contract. Direct-parameter parent sets pass only when those contracts match exactly; q8_0 and q4_0 artifacts with the same shape remain separate lanes until a future source-conversion or distillation route writes a new admitted candidate.

The lineage template records a planned candidate id, operator id, resource budget, parent checksums, compatibility report checksum, and pending candidate artifact fields. It is the handoff point between parent selection and an offline operator. `blend-candidate` recomputes compatible parent tensors into f32 values, blends them by parts-per-million weights, writes a normal `.slm`, and records a receipt that `validate-blend-candidate` can reproduce exactly. `delta-candidate` uses the same gates, treats parent 0 as base and parent 1 as target, then writes `base + weight * (target - base)` candidates with signed parts-per-million weights and a receipt that `validate-delta-candidate` recomputes exactly. `sparse-delta-candidate` selects the largest absolute target-minus-base deltas by keep rate, applies the signed task-vector weight only to selected entries, keeps other entries at base values, and records a receipt that `validate-sparse-delta-candidate` recomputes exactly. `adapter-delta` uses the compatibility and lineage gates to write an offline `ADP1` raw f32 task-delta package plus a recomputable manifest; `fuse-adapter-delta` proves that package still matches its parents, fuses it into a normal `.slm` candidate, and records a receipt that `validate-fuse-adapter-delta` recomputes exactly. The candidate artifact manifest is the next `.slm` handoff point: it accepts a validated lineage plus a validated `.slm`, records the candidate checksum and layout, and keeps eval plus promotion as the next gate. The promotion template binds that candidate manifest to pending runtime-smoke and eval proof while keeping browser selector admission closed. The runtime-smoke sidecar then binds local execution proof to the exact provenance manifest and model checksum; selector admission still requires passed eval evidence. Promotion ledgers chain admitted records into deterministic history before selector or population review. Selector registries are the served-model handoff after admission: they accept admission records only when the candidate artifact path resolves under `tinyrustlm/models/`, then write browser routes such as `../models/admitted-q8.slm`.

`tiny-test-model-bpe.slm` is the custom-tokenizer runtime fixture. It uses `BPE1`, vocab 262, and the deterministic `the` merge path so runtime diagnostics can prove the model selected BPE and produced tokenizer output `256,261` before generation.

`tiny-test-model-tied.slm` is the tied-output runtime fixture. It intentionally omits `output.weight`, sets the v1 tied-output flag, and proves the loader and generator route output projection through `tok_embeddings.weight`. The validator must reject the same missing-output shape when the tied-output flag is absent.

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
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\target\trained-source-smoke\tiny-converted-q8.runtime
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
```

After compatibility, lineage, candidate, and promotion sidecars exist for a converted-trained candidate, the selector admission command binds them to runtime-smoke and eval evidence:

```powershell
cargo run -p tinyrustlm-slm-pack -- admission-record .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\admission-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate .\target\admission-smoke\tiny-converted-q8.promotion .\target\admission-smoke\tiny-converted-q8.slm.manifest .\target\admission-smoke\tiny-converted-q8.runtime .\target\admission-smoke\tiny-converted-q8.eval .\target\admission-smoke\tiny-converted-q8.admission browser-local-selector
cargo run -p tinyrustlm-slm-pack -- validate-admission .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\admission-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate .\target\admission-smoke\tiny-converted-q8.promotion .\target\admission-smoke\tiny-converted-q8.slm.manifest .\target\admission-smoke\tiny-converted-q8.runtime .\target\admission-smoke\tiny-converted-q8.eval .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- promotion-ledger .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-promotion-ledger .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- selector-registry .\target\selector-smoke\selector.registry .\target\selector-smoke\admitted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-selector-registry .\target\selector-smoke\selector.registry .\target\selector-smoke\admitted-q8.admission
```

The registry commands expect the admitted candidate path to be browser-served. A target-only converted candidate should be staged under the local `tinyrustlm/models/` route, with its `.slm.manifest`, before writing a `selector.registry` for the browser selector.

Generate a tied-output source bundle when the trained source intentionally shares token embeddings with the output projection:

```powershell
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-tied tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-tied
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- validate .\target\trained-source-smoke\tiny-tied-converted-q8.slm
```

`convert-trained` reads `source.manifest` plus raw f32 tensor files under `tensors/`, rejects unsafe paths, checksum drift, wrong byte counts, wrong shapes, non-finite values, out-of-range weights, and all-zero tensors, then writes a checksum-bearing `.slm` plus a `converted-trained` manifest. A source manifest can declare `tied_output=true` only with a tied shape such as `tiny-fixture-tied` or `tinylm16-tied`; that layout omits `output.weight` and conversion sets the v1 tied-output flag. `tinyrustlm-eval` executes exact cases through the Rust runtime and writes a scoped eval sidecar. The checked-in eval cases prove only the tiny converted-source fixture scope; they are not a product assistant-quality claim.

Check the explicit quality gate before making a claim about an artifact:

```powershell
cargo run -p tinyrustlm-slm-pack -- quality-gate .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\target\model-breeding\tinylm16-q8-self.runtime
cargo run -p tinyrustlm-slm-pack -- eval-template .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\tinyrustlm\models\tinylm16-q8.slm.eval assistant-quality
```

`runtime-smoke` proves only local runtime execution and can also write a durable sidecar. `assistant-quality` requires a converted-trained manifest plus a separate eval sidecar with matching model and manifest checksums, passed task evaluation, passed safety review, a non-placeholder quality scope, and `quality_decision=accepted-for-assistant-quality`. The generated eval template is intentionally `pending` and must fail `assistant-quality` until reviewed evidence replaces the placeholder fields.

Current artifact SHA256 values:

- `tiny-test-model.slm`: `17D79EE766578729D2B69090547E819E011D76115519514E19AC3754DE610A1A`
- `tiny-test-model-q8.slm`: `6AF985853325EAA6D3EAAA8AADD3511DA9596EB542FB2D03A9BC9DC1F4377ADF`
- `tiny-test-model-q4.slm`: `4004E2152F0B6382C6043A15084DE6DC4AE6AE6B6C5BA43ABDE8812ED0174CF6`
- `tiny-test-model-bpe.slm`: `31B27903C1588A1F246281DEF8027094C0D3862635FA7D3761AA1327471F3E82`
- `tiny-test-model-tied.slm`: `9D68DC80CD2CCC2366344B92A497629AF1D693350F92B3B0EE383D4B30E08B7C`
- `tinylm16-f32.slm`: `70E9765080247FE859506534E87330D73FF50B66B8A48DC627C307069BB0DC5B`
- `tinylm16-q8.slm`: `C3919E6D7244890E9B3C2B5E40C37F8D322467D859C15B8155700F20408DB950`
- `tinylm16-q4.slm`: `5AC2BD957113732BE9AB2AADFA2D2EFD54C3131E7E6C97BE424FAC6E72BB365B`

Current manifest SHA256 values:

- `tiny-test-model.slm.manifest`: `04A621560A3F24C8E8243A1D085CACB6944CAD0898967582500EDE6D885B1B81`
- `tiny-test-model-q8.slm.manifest`: `85AC07502280F1D05B18A6932B83465C60CA59EE1B4D157A45C668380131294F`
- `tiny-test-model-q4.slm.manifest`: `EB53E4A34D831571BE34B29049D07901E85411561E761DC2C9E37C60827B853F`
- `tiny-test-model-bpe.slm.manifest`: `AE28DDD62E91834A1F7F6D29BE186CB9EA81A92FAEBC0A5AF3E5A4897DC15B52`
- `tiny-test-model-tied.slm.manifest`: `469A78D503B010323709EEAF6731DC8AFE05F0DE442BC16BC63F58C636A1490C`
- `tinylm16-f32.slm.manifest`: `D9CDEF0D7CE09979EF8D824BCF68555322B89A286DE197148CD2263F654E3010`
- `tinylm16-q8.slm.manifest`: `21178B39642AE045CB26FE99B1595BC5B193AE563EC17F7545E478316CBFAA70`
- `tinylm16-q4.slm.manifest`: `7B1C77776876EC9BE80DD00CEFB6C7AE877FD592FBF4FAD5029080B36B8D46CB`

`tinylm16-f32.slm`, `tinylm16-q8.slm`, and `tinylm16-q4.slm` are deterministic real-shaped smoke models. The q4_0 artifact is 10,657,728 bytes and uses direct q4_0 matrix dispatch in the runtime.
