---
title: Model Breeding Reference Ideas 2026-06-26
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/research/model-breeding-reference-ideas-2026-06-26/
status: planned_pending_publication
reviewed_utc: 2026-06-27T03:21:25Z
---

# Model Breeding Reference Ideas

This record routes primary research and setup references that are useful for turning the 2026-06-26 report batch into future TinyRustLM work.

## Primary Research Routes

| Reference | Project use |
| --- | --- |
| [Model soups: averaging weights of multiple fine-tuned models improves accuracy without increasing inference time](https://arxiv.org/abs/2203.05482) | Weight averaging can be a future offline operator when parent models share one low-loss basin and exact schema compatibility. |
| [Git Re-Basin: Merging Models modulo Permutation Symmetries](https://arxiv.org/abs/2209.04836) | Alignment before merge matters; future compatibility checks should treat tensor schema and hidden-unit alignment as explicit metadata. |
| [Editing Models with Task Arithmetic](https://arxiv.org/abs/2212.04089) | Task vectors suggest a candidate-delta format where base weights and deltas are tracked separately with parent hashes. |
| [TIES-Merging: Resolving Interference When Merging Models](https://arxiv.org/abs/2306.01708) | Sign agreement remains a future multi-parent candidate lane; parent-pool recipes now provide the ranked shared-contract parent set before that work. |
| [Language Models are Super Mario: Absorbing Abilities from Homologous Models as a Free Lunch](https://arxiv.org/abs/2311.03099) | DARE-style sparse deltas map to the lineage-bound sparse task-delta candidate lane, with rescale variants left as future operator metadata. |
| [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) | LoRA now maps to offline adapter-package and adapter-fuse gates, with runtime apply kept as a future typed boundary. |
| [Population Based Training of Neural Networks](https://arxiv.org/abs/1711.09846) | Population-style candidate evaluation now maps to `population-review` plus `parent-pool-recipe`: fitness scores, frontier selection, parent routing, seed weights, resource budgets, and staged promotion. |
| [Communication-Efficient Learning of Deep Networks from Decentralized Data](https://arxiv.org/abs/1602.05629) | FedAvg is a reference lane for federated or on-device parent updates; in TinyRustLM it maps to offline recipe metadata and evidence records. |
| [Evolution Strategies as a Scalable Alternative to Reinforcement Learning](https://arxiv.org/abs/1703.03864) | Evolution-style search maps to population-level candidate proposal, fitness fields, and resource-budget records before promotion. |
| [Overcoming catastrophic forgetting in neural networks](https://arxiv.org/abs/1612.00796) | Retention metrics can inspire eval sidecar cases when a candidate absorbs a new task without dropping old fixture behavior. |
| [PackNet: Adding Multiple Tasks to a Single Network by Iterative Pruning](https://arxiv.org/abs/1711.05769) | Task-specific pruning suggests future mask or slot metadata for keeping small skills separable inside compact artifacts. |
| [The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks](https://arxiv.org/abs/1803.03635) | Sparse subnetworks inform pruning, mask, and compact-candidate experiments that still pass ordinary `.slm` validation. |
| [Parameter-Efficient Transfer Learning for NLP](https://arxiv.org/abs/1902.00751) | Adapter modules give a broader adapter-family lane beyond LoRA for future package manifests and fuse receipts. |
| [QLoRA: Efficient Finetuning of Quantized LLMs](https://arxiv.org/abs/2305.14314) | Quantized adapter training is a future comparison lane for q8/q4 artifacts plus adapter formats, not a current runtime claim. |

## UAIX Setup Route

- [UAIX AI Memory Package Wizard](https://uaix.org/en-us/tools/ai-memory-package-wizard/#setup-file-handoff) routes this project toward File Handoff plus LLM Wiki: active intake buckets, raw evidence preservation, durable wiki synthesis, hot `.uai` routing, and pointer-only long-term memory.

## Research-To-Implementation Map

- Soups and task arithmetic become offline operators, not browser runtime features.
- TIES and DARE become compatibility and merge recipe metadata; implemented slices are `sparse-delta-candidate` for largest absolute task deltas and `parent-pool-recipe` for ranked shared-contract parent sets.
- LoRA becomes adapter package and adapter-fuse work: validated packages can produce normal `.slm` candidates, while runtime apply remains future work.
- PBT becomes population-review plus parent-pool recipe logic: parent selection, fitness scores, seed weights, budget caps, frontier routing, parent-pool routing, and promotion evidence.
- FedAvg and evolution strategies become population-recipe references: they can shape future metadata for distributed parent updates, search budgets, and promotion ledgers.
- EWC, PackNet, lottery tickets, adapters, and QLoRA become retention, pruning, mask, and compact-update reference lanes for future eval sidecars and adapter manifests.
- UAIX File Handoff keeps dropped reports transient while raw evidence and durable synthesis carry long-memory authority.

## Routing Rule

Use this page for reference selection. Use `model-breeding-ecology-memory-2026-06-26.md` for project synthesis. Use `.uai/short-term-memory.uai` for the current handoff state.
