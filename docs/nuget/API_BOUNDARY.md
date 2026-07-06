# API Boundary

The NuGet SDK exposes only public ecosystem capabilities.

## Public Surface

- `.slm` validation and inspection through `TinySlmInspector`.
- Runtime lifecycle through `TinyRustLmRuntimeFactory` and `ITinyRustLmRuntime`.
- Runtime operations: create, destroy, load model, unload model, generate, step, reset, diagnostics, version, and capability query. Managed generation options are validated before P/Invoke, and the native public runtime SDK validates the same fixed-buffer sampler contract before runtime mutation, so invalid token counts, sampler candidate caps, and non-finite sampling values fail before generation work begins.
- Managed strings crossing the native boundary reject embedded NUL characters before P/Invoke so paths, prompts, JSON handoff documents, and share-kit request fields cannot be truncated by C-string parsing. Empty strings are preserved as real empty native strings rather than null pointers; null remains the "not supplied" sentinel for optional native arguments.
- P2P metadata-bound workflows through `TinyRustLmP2PClient`: prepare a typed local share-kit report, inspect manifest, plan import from manifest, locally assemble manifest-declared pieces into a verified `.slm`, write and inspect a local import receipt sidecar, export typed share metadata, validate announcement, apply received announcement, and inspect announcement catalogs. The managed wrapper rejects missing share-kit model/output paths and piece sizes outside 1 KiB through 16 MiB before serializing request JSON, and rejects oversized JSON handoff documents before P/Invoke: manifests over 1 MiB, announcements over 256 KiB, local import receipts over 256 KiB, and announcement catalogs over 4 MiB. Public announcement URLs are limited to HTTPS or explicit-port loopback HTTP, with credentials, query strings, fragments, and traversal rejected. Announcement catalogs reject conflicting same-peer/same-manifest metadata before mutation and are capped at 4 MiB before parsing. `ValidateAnnouncementJson`, `ApplyReceivedAnnouncementJson`, and `InspectAnnouncementCatalogJson` provide announcement/catalog JSON handoff for audit files and catalog exchange without exposing private routing logic; other raw JSON helpers exist only for exact handoff/audit documents.

## Private Surface Not Packaged

The NuGet projects and native bridge do not reference `slm_pack`, conversion commands, selector registry generation, adapter-family code, training-source code, offline breeding operators, promotion logic, premium optimizers, telemetry, license-server internals, or commercial orchestration.

## Extension Points

Commercial or proprietary features should attach behind separate packages or services. Public packages may accept already-produced `.slm` files, local manifest-declared pieces, and metadata, but must not reveal authoring recipes, ranking logic, training data, model optimization strategies, encryption keys, peer-discovery services, premium routing, or enterprise orchestration workflows.
