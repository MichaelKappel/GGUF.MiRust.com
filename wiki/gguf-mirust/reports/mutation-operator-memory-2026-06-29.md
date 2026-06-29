---
title: Mutation Operator Memory 2026-06-29
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/mutation-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T07:05:00Z
---

# Mutation Operator Memory

TinyRustLM now has an offline deterministic bounded mutation operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/mutation.rs` adds `mutation-candidate` and `validate-mutation-candidate` support for compatible two-parent `.slm` files.
- Parent 0 is the base layout and output contract; parent 1 is the compatible reference parent used for bounded value-scale context.
- The operator selects tensor elements by `mutation_seed` plus `mutation_rate_ppm`, applies signed deterministic perturbations bounded by `mutation_magnitude_ppm`, and writes a normal `.slm` candidate in the base parent's dtype/layout.
- The receipt records selection counts, changed counts, selection density, `mutation_mask_checksum`, and `mutation_delta_checksum`.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and usage line.

## Receipt Fields

- `tinyrustlm_mutation_operator_version=1`
- `operator_kind=deterministic-bounded-parameter-mutation`
- `base_parent_index=0`
- `reference_parent_index=1`
- `mutation_seed=<u64>`
- `mutation_rate_unit=parts-per-million`
- `mutation_rate_ppm=<0..1000000>`
- `mutation_magnitude_unit=parts-per-million-of-value-scale`
- `mutation_magnitude_ppm=<0..1000000>`
- `mutation_selection_metric=splitmix64-tensor-element-threshold`
- `mutation_selection_scope=compatible-base-tensor-values`
- `mutation_tie_break=mutate-when-threshold-equal`
- `mutation_value_scale=max-abs-parent-value-or-one`
- `mutation_total_parameter_count`, `mutation_selected_parameter_count`, `mutation_changed_parameter_count`
- `mutation_selection_density_ppm`
- `mutation_mask_checksum`
- `mutation_delta_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml mutation -- --nocapture` passed with 11 mutation tests.
- CLI smoke wrote `target/mutation-cli/parents.compat`.
- CLI smoke wrote `target/mutation-cli/candidate.lineage`.
- CLI smoke wrote `target/mutation-cli/candidate.slm` and `target/mutation-cli/candidate.operator` with seed `77`, rate `1000000`, and magnitude `100000`.
- CLI smoke validated the mutation candidate and receipt with `validate-mutation-candidate`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml -- --nocapture` passed with 252 tests.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, formatting, and the CLI write/validate smoke.

## Test Coverage Notes

- `mutation_seed` is covered by seed-different candidate and mask checksum tests.
- `mutation_rate_ppm` is covered by rate-zero, full-rate, partial-rate, default, and invalid parse tests.
- `mutation_magnitude_ppm` is covered by magnitude-zero, magnitude-different, default, and invalid parse tests.
- The reference parent parameter is covered by a scale-different candidate test and compatibility-bound checksum validation.
- Parent path inputs are covered by path-level write/validate and parent checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, and candidate drift rejection.
- Quantization route behavior is covered by q8 candidate validation.

## Routing

Open this report before changing `mutation.rs`, `mutation-candidate`, `validate-mutation-candidate`, deterministic mutation masks, mutation receipt fields, or mutation parameter validation.
