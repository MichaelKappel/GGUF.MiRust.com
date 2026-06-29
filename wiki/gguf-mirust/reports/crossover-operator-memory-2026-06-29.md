---
title: Crossover Operator Memory 2026-06-29
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/crossover-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T06:20:00Z
---

# Crossover Operator Memory

TinyRustLM now has an offline deterministic direct-parameter crossover operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/crossover.rs` adds `crossover-candidate` and `validate-crossover-candidate` support for compatible two-parent `.slm` files.
- The operator selects each tensor element from parent 0 or parent 1 using `crossover_seed` plus `crossover_parent0_keep_ppm`; the receipt records total parameter count, per-parent selection counts, density in parts-per-million, and `crossover_mask_checksum`.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and help text.

## Receipt Fields

- `tinyrustlm_crossover_operator_version=1`
- `operator_kind=deterministic-direct-parameter-crossover`
- `crossover_seed=<u64>`
- `crossover_parent0_keep_unit=parts-per-million`
- `crossover_parent0_keep_ppm=<0..1000000>`
- `crossover_parent1_keep_ppm=<1000000-parent0>`
- `crossover_selection_metric=splitmix64-tensor-element-threshold`
- `crossover_selection_scope=compatible-parent-tensor-values`
- `crossover_tie_break=parent0-when-threshold-equal`
- `crossover_total_parameter_count`, `crossover_parent0_parameter_count`, `crossover_parent1_parameter_count`
- `crossover_parent0_density_ppm`, `crossover_parent1_density_ppm`
- `crossover_mask_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml crossover -- --nocapture` passed with 9 crossover tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml -- --nocapture` passed with 241 tests.
- CLI smoke wrote `target/crossover-cli/same-parent.compat`.
- CLI smoke wrote `target/crossover-cli/same-parent.lineage`.
- CLI smoke wrote `target/crossover-cli/same-parent-crossover.slm` and `target/crossover-cli/same-parent-crossover.operator` with explicit seed `77` and keep `500000`.
- CLI smoke validated the crossover candidate and receipt with `validate-crossover-candidate`.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, formatting, and the CLI write/validate smoke.

## Test Coverage Notes

- `crossover_seed` is covered by seed-different candidate and mask checksum tests.
- `crossover_parent0_keep_ppm` is covered by zero, full, partial, default, and invalid parse tests.
- Parent path inputs are covered by path-level write/validate and compatibility-bound checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, and candidate drift rejection.
- Quantization route behavior is covered by q8 candidate validation.

## Routing

Open this report before changing `crossover.rs`, `crossover-candidate`, `validate-crossover-candidate`, deterministic selection masks, crossover receipt fields, or crossover parameter validation.
