---
title: Model Breeding Reference Ideas 2026-06-26
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/research/model-breeding-reference-ideas-2026-06-26/
status: planned_pending_publication
reviewed_utc: 2026-06-27T02:47:09Z
---

# Model Breeding Reference Ideas

This record routes primary research and setup references that are useful for turning the 2026-06-26 report batch into future TinyRustLM work.

## Primary Research Routes

| Reference | Project use |
| --- | --- |
| [Model soups: averaging weights of multiple fine-tuned models improves accuracy without increasing inference time](https://arxiv.org/abs/2203.05482) | Weight averaging can be a future offline operator when parent models share one low-loss basin and exact schema compatibility. |
| [Git Re-Basin: Merging Models modulo Permutation Symmetries](https://arxiv.org/abs/2209.04836) | Alignment before merge matters; future compatibility checks should treat tensor schema and hidden-unit alignment as explicit metadata. |
| [Editing Models with Task Arithmetic](https://arxiv.org/abs/2212.04089) | Task vectors suggest a candidate-delta format where base weights and deltas are tracked separately with parent hashes. |
| [TIES-Merging: Resolving Interference When Merging Models](https://arxiv.org/abs/2306.01708) | Sign agreement remains a future multi-parent merge lane; sparse parameter selection maps to the `sparse-delta-candidate` receipt bead. |
| [Language Models are Super Mario: Absorbing Abilities from Homologous Models as a Free Lunch](https://arxiv.org/abs/2311.03099) | DARE-style sparse deltas map to the lineage-bound sparse task-delta candidate lane, with rescale variants left as future operator metadata. |
| [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) | LoRA now maps to offline adapter-package and adapter-fuse gates, with runtime apply kept as a future typed boundary. |
| [Population Based Training of Neural Networks](https://arxiv.org/abs/1711.09846) | Population-style candidate evaluation now maps to `population-review`: fitness scores, frontier selection, parent-pool routing, resource budgets, and staged promotion. |

## UAIX Setup Route

- [UAIX AI Memory Package Wizard](https://uaix.org/en-us/tools/ai-memory-package-wizard/#setup-file-handoff) routes this project toward File Handoff plus LLM Wiki: active intake buckets, raw evidence preservation, durable wiki synthesis, hot `.uai` routing, and pointer-only long-term memory.

## Research-To-Implementation Map

- Soups and task arithmetic become offline operators, not browser runtime features.
- TIES and DARE become compatibility and merge recipe metadata; the implemented sparse slice is `sparse-delta-candidate`, which keeps largest absolute task deltas under the normal `.slm` candidate path.
- LoRA becomes adapter package and adapter-fuse work: validated packages can produce normal `.slm` candidates, while runtime apply remains future work.
- PBT becomes population-review logic: parent selection, fitness scores, budget caps, frontier routing, parent-pool routing, and promotion evidence.
- UAIX File Handoff keeps dropped reports transient while raw evidence and durable synthesis carry long-memory authority.

## Routing Rule

Use this page for reference selection. Use `model-breeding-ecology-memory-2026-06-26.md` for project synthesis. Use `.uai/short-term-memory.uai` for the current handoff state.
