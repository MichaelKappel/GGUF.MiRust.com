//! Browser-local adapter family receipts for ADP1 sidecars.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::provenance;
use crate::selector::{self, RegistryAdapterFamilyRoute, RegistryAdapterRoute};

const ADAPTER_FAMILY_RECEIPT_VERSION: &str = "1";
const ADAPTER_FAMILY_KIND: &str = "browser-local-adapter-family";
const ADAPTER_FAMILY_STATUS: &str = "validated";
const ADAPTER_FAMILY_STRATEGY: &str = "single-adapter-selection";
const ADAPTER_ARTIFACT_VERSION: &str = "1";
const ADAPTER_ARTIFACT_KIND: &str = "raw-f32-task-delta-v1";
const SPARSE_ADAPTER_ARTIFACT_KIND: &str = "sparse-f32-task-delta-v1";
const ADAPTER_STATUS: &str = "artifact-written";
const ADAPTER_DTYPE: &str = "f32-delta";
const SPARSE_ADAPTER_DTYPE: &str = "sparse-f32-delta";
const ADAPTER_APPLY_STATUS_F32: &str = "runtime-f32-compatible-or-fuse-to-slm";
const ADAPTER_APPLY_STATUS_QUANTIZED: &str = "runtime-q8-q4-compatible-or-fuse-to-slm";
const REQUIRED_NEXT_GATE: &str = "browser-loads-selector-registry-adapter-family";
const SHARED_IDENTITY_KEYS: &[&str] = &[
    "adapter_tensor_count",
    "adapter_parameter_count",
    "adapter_model_shape",
    "adapter_base_quantization",
    "adapter_output_contract",
    "adapter_tokenizer_checksum",
    "adapter_tensor_layout_checksum",
    "adapter_base_contract",
];

/// One adapter manifest and its registry route for a family receipt.
pub(crate) struct AdapterFamilyInput<'a> {
    /// The browser selector route for this adapter.
    pub(crate) route: &'a RegistryAdapterRoute,
    /// Local manifest path that proves the adapter route fields.
    pub(crate) manifest_path: &'a Path,
}

struct AdapterFamilyMember<'a> {
    route: &'a RegistryAdapterRoute,
    manifest_text: String,
    fields: HashMap<String, String>,
}

/// Writes a deterministic adapter-family receipt and returns its registry route.
pub(crate) fn write_receipt_path(
    candidate_id: &str,
    label: &str,
    receipt_route_path: &str,
    output_receipt: &Path,
    inputs: &[AdapterFamilyInput<'_>],
) -> io::Result<RegistryAdapterFamilyRoute> {
    let receipt = build_receipt_text(candidate_id, label, receipt_route_path, inputs)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, &receipt)?;
    let route = RegistryAdapterFamilyRoute {
        candidate_id: candidate_id.to_string(),
        receipt_path: receipt_route_path.to_string(),
        label: label.to_string(),
        status: "receipt-validated".to_string(),
        strategy: ADAPTER_FAMILY_STRATEGY.to_string(),
        receipt_checksum: hex64(provenance::text_checksum(receipt.as_bytes())),
        adapter_count: inputs.len(),
    };
    selector::validate_registry_adapter_family_route(&route)?;
    println!(
        "SLM adapter-family receipt written: {}",
        output_receipt.display()
    );
    Ok(route)
}

/// Validates a receipt by recomputing it from its adapter manifests.
pub(crate) fn validate_receipt_path(
    receipt: &Path,
    inputs: &[AdapterFamilyInput<'_>],
) -> io::Result<()> {
    let receipt_text = fs::read_to_string(receipt)?;
    validate_receipt_text(&receipt_text, inputs)?;
    println!("SLM adapter-family receipt validation: PASS");
    println!("receipt: {}", receipt.display());
    Ok(())
}

fn validate_receipt_text(receipt_text: &str, inputs: &[AdapterFamilyInput<'_>]) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "adapter-family receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_adapter_family_receipt_version",
        ADAPTER_FAMILY_RECEIPT_VERSION,
    )?;
    require_equal(&receipt, "adapter_family_kind", ADAPTER_FAMILY_KIND)?;
    require_equal(&receipt, "adapter_family_status", ADAPTER_FAMILY_STATUS)?;
    require_equal(&receipt, "adapter_family_strategy", ADAPTER_FAMILY_STRATEGY)?;
    let candidate_id = require_key(&receipt, "candidate_id")?;
    let label = require_key(&receipt, "adapter_family_label")?;
    let receipt_route_path = require_key(&receipt, "adapter_family_receipt_path")?;
    let expected = build_receipt_text(candidate_id, label, receipt_route_path, inputs)?;
    if receipt_text != expected {
        return Err(invalid(
            "adapter-family receipt fields do not match recomputed manifests",
        ));
    }
    Ok(())
}

fn build_receipt_text(
    candidate_id: &str,
    label: &str,
    receipt_route_path: &str,
    inputs: &[AdapterFamilyInput<'_>],
) -> io::Result<String> {
    validate_candidate_id(candidate_id)?;
    validate_label(label, "adapter family label")?;
    validate_receipt_route_path(receipt_route_path)?;
    let members = collect_members(candidate_id, inputs)?;
    let first = members
        .first()
        .ok_or_else(|| invalid("adapter family requires at least two members"))?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_family_receipt_version",
        ADAPTER_FAMILY_RECEIPT_VERSION,
    );
    push_line(&mut text, "adapter_family_kind", ADAPTER_FAMILY_KIND);
    push_line(&mut text, "adapter_family_status", ADAPTER_FAMILY_STATUS);
    push_line(&mut text, "candidate_id", candidate_id);
    push_line(&mut text, "adapter_family_label", label);
    push_line(&mut text, "adapter_family_receipt_path", receipt_route_path);
    push_line(
        &mut text,
        "adapter_family_strategy",
        ADAPTER_FAMILY_STRATEGY,
    );
    push_line(&mut text, "adapter_count", &members.len().to_string());
    let preferred_index = preferred_member_index(&members);
    let preferred = &members[preferred_index];
    push_line(
        &mut text,
        "adapter_family_preferred_adapter_index",
        &preferred_index.to_string(),
    );
    push_line(
        &mut text,
        "adapter_family_preferred_adapter_path",
        preferred.route.adapter_path.as_str(),
    );
    push_line(
        &mut text,
        "adapter_family_preferred_manifest_path",
        preferred.route.manifest_path.as_str(),
    );
    for key in SHARED_IDENTITY_KEYS {
        push_line(
            &mut text,
            &format!("family.{key}"),
            require_key(&first.fields, key)?,
        );
    }
    for (index, member) in members.iter().enumerate() {
        push_member_lines(&mut text, index, member)?;
    }
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn collect_members<'a>(
    candidate_id: &str,
    inputs: &'a [AdapterFamilyInput<'a>],
) -> io::Result<Vec<AdapterFamilyMember<'a>>> {
    if inputs.len() < 2 || inputs.len() > 16 {
        return Err(invalid("adapter family member count must be 2 through 16"));
    }
    let mut seen_adapter_paths = HashSet::new();
    let mut seen_manifest_paths = HashSet::new();
    let mut members = Vec::with_capacity(inputs.len());
    for input in inputs {
        selector::validate_registry_adapter_route(input.route)?;
        if input.route.candidate_id != candidate_id {
            return Err(invalid(
                "adapter family route candidate_id must match the receipt candidate_id",
            ));
        }
        if !seen_adapter_paths.insert(input.route.adapter_path.as_str()) {
            return Err(invalid("duplicate adapter family adapter path"));
        }
        if !seen_manifest_paths.insert(input.route.manifest_path.as_str()) {
            return Err(invalid("duplicate adapter family manifest path"));
        }
        let manifest_text = fs::read_to_string(input.manifest_path)?;
        let fields = parse_manifest(&manifest_text, "adapter family member manifest")?;
        validate_member_manifest(input.route, &manifest_text, &fields)?;
        members.push(AdapterFamilyMember {
            route: input.route,
            manifest_text,
            fields,
        });
    }
    validate_shared_identity(&members)?;
    Ok(members)
}

fn validate_member_manifest(
    route: &RegistryAdapterRoute,
    manifest_text: &str,
    fields: &HashMap<String, String>,
) -> io::Result<()> {
    require_equal(
        fields,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    )?;
    let format = adapter_format_for_route(&route.adapter_path)?;
    require_equal(fields, "adapter_artifact_kind", format.artifact_kind)?;
    require_equal(fields, "adapter_status", ADAPTER_STATUS)?;
    require_equal(fields, "adapter_dtype", format.dtype)?;
    let base_quantization = require_key(fields, "adapter_base_quantization")?;
    validate_apply_status_for_quantization(&route.apply_status, &base_quantization)?;
    require_equal(fields, "adapter_apply_status", &route.apply_status)?;
    require_equal(
        fields,
        "adapter_artifact_checksum",
        &route.artifact_checksum,
    )?;
    let manifest_checksum = hex64(provenance::text_checksum(manifest_text.as_bytes()));
    if route.manifest_checksum != manifest_checksum {
        return Err(invalid(
            "adapter family route manifest checksum does not match manifest text",
        ));
    }
    for key in SHARED_IDENTITY_KEYS {
        require_key(fields, key)?;
    }
    Ok(())
}

struct AdapterManifestFormat {
    artifact_kind: &'static str,
    dtype: &'static str,
}

fn adapter_format_for_route(adapter_path: &str) -> io::Result<AdapterManifestFormat> {
    if adapter_path.ends_with(".adp1") {
        return Ok(AdapterManifestFormat {
            artifact_kind: ADAPTER_ARTIFACT_KIND,
            dtype: ADAPTER_DTYPE,
        });
    }
    if adapter_path.ends_with(".asp1") {
        return Ok(AdapterManifestFormat {
            artifact_kind: SPARSE_ADAPTER_ARTIFACT_KIND,
            dtype: SPARSE_ADAPTER_DTYPE,
        });
    }
    Err(invalid("adapter family member route format is invalid"))
}

fn validate_apply_status_for_quantization(status: &str, quantization: &str) -> io::Result<()> {
    let expected = match quantization {
        "f32" => ADAPTER_APPLY_STATUS_F32,
        "q8_0" | "q4_0" => ADAPTER_APPLY_STATUS_QUANTIZED,
        _ => return Err(invalid("adapter family base quantization is invalid")),
    };
    if status != expected {
        return Err(invalid(
            "adapter family apply status does not match base quantization",
        ));
    }
    Ok(())
}

fn validate_shared_identity(members: &[AdapterFamilyMember<'_>]) -> io::Result<()> {
    let first = members
        .first()
        .ok_or_else(|| invalid("adapter family requires at least two members"))?;
    for member in members.iter().skip(1) {
        for key in SHARED_IDENTITY_KEYS {
            if require_key(&member.fields, key)? != require_key(&first.fields, key)? {
                return Err(invalid(&format!(
                    "adapter family members must share one {key}"
                )));
            }
        }
    }
    Ok(())
}

fn preferred_member_index(members: &[AdapterFamilyMember<'_>]) -> usize {
    members
        .iter()
        .position(|member| member.route.adapter_path.ends_with(".asp1"))
        .unwrap_or(0)
}

fn push_member_lines(
    text: &mut String,
    index: usize,
    member: &AdapterFamilyMember<'_>,
) -> io::Result<()> {
    let prefix = format!("adapter.{index}");
    push_line(
        text,
        &format!("{prefix}.path"),
        member.route.adapter_path.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.manifest_path"),
        member.route.manifest_path.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.label"),
        member.route.label.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.apply_status"),
        member.route.apply_status.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.artifact_checksum"),
        member.route.artifact_checksum.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.manifest_checksum"),
        member.route.manifest_checksum.as_str(),
    );
    push_line(
        text,
        &format!("{prefix}.manifest_bytes"),
        &member.manifest_text.len().to_string(),
    );
    for key in SHARED_IDENTITY_KEYS {
        push_line(
            text,
            &format!("{prefix}.{key}"),
            require_key(&member.fields, key)?,
        );
    }
    Ok(())
}

fn validate_candidate_id(candidate_id: &str) -> io::Result<()> {
    if candidate_id.is_empty()
        || candidate_id.len() > 160
        || !candidate_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(invalid("adapter family candidate_id is invalid"));
    }
    Ok(())
}

fn validate_label(label: &str, label_name: &str) -> io::Result<()> {
    if label.trim().is_empty() || label.contains('\r') || label.contains('\n') || label.len() > 160
    {
        return Err(invalid(&format!("{label_name} is invalid")));
    }
    Ok(())
}

fn validate_receipt_route_path(path: &str) -> io::Result<()> {
    let normalized = path.replace('\\', "/");
    let Some(rest) = normalized.strip_prefix("../models/") else {
        return Err(invalid(
            "adapter family receipt route must point at served ../models receipt artifacts",
        ));
    };
    if rest.is_empty()
        || !rest.ends_with(".adapter-family.receipt")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid("adapter family receipt route is invalid"));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid("adapter family receipt route is invalid"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_and_validates_adapter_family_receipt() {
        let dir = unique_dir("family");
        fs::create_dir_all(&dir).unwrap();
        let first_manifest = member_manifest("0x00000000000000aa", "0x00000000000000f1");
        let second_manifest = sparse_member_manifest("0x00000000000000bb", "0x00000000000000f1");
        let first_manifest_path = dir.join("first.adp1.manifest");
        let second_manifest_path = dir.join("second.asp1.manifest");
        fs::write(&first_manifest_path, &first_manifest).unwrap();
        fs::write(&second_manifest_path, &second_manifest).unwrap();
        let first = route(
            "../models/first.adp1",
            "First ADP1",
            "0x00000000000000aa",
            &first_manifest,
        );
        let second = route(
            "../models/second.asp1",
            "Second ASP1",
            "0x00000000000000bb",
            &second_manifest,
        );
        let inputs = [
            AdapterFamilyInput {
                route: &first,
                manifest_path: &first_manifest_path,
            },
            AdapterFamilyInput {
                route: &second,
                manifest_path: &second_manifest_path,
            },
        ];
        let receipt_path = dir.join("candidate.adapter-family.receipt");

        let receipt_route = write_receipt_path(
            "candidate-a",
            "Candidate ADP1 family",
            "../models/candidate.adapter-family.receipt",
            &receipt_path,
            &inputs,
        )
        .unwrap();

        validate_receipt_path(&receipt_path, &inputs).unwrap();
        let receipt = fs::read_to_string(&receipt_path).unwrap();
        assert!(receipt.contains("adapter_family_kind=browser-local-adapter-family"));
        assert!(receipt.contains("adapter_family_preferred_adapter_index=1"));
        assert!(receipt.contains("adapter_family_preferred_adapter_path=../models/second.asp1"));
        assert!(receipt
            .contains("adapter_family_preferred_manifest_path=../models/second.asp1.manifest"));
        assert!(receipt.contains("adapter.1.path=../models/second.asp1"));
        assert!(receipt.contains("family.adapter_tensor_layout_checksum=0x00000000000000f1"));
        assert_eq!(receipt_route.adapter_count, 2);
        assert_eq!(receipt_route.status, "receipt-validated");

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn writes_and_validates_quantized_adapter_family_receipt() {
        let dir = unique_dir("quantized-family");
        fs::create_dir_all(&dir).unwrap();
        let first_manifest = member_manifest_with_quantization(
            "0x00000000000000aa",
            "0x00000000000000f1",
            "q8_0",
            ADAPTER_APPLY_STATUS_QUANTIZED,
        );
        let second_manifest = member_manifest_with_quantization(
            "0x00000000000000bb",
            "0x00000000000000f1",
            "q8_0",
            ADAPTER_APPLY_STATUS_QUANTIZED,
        );
        let first_manifest_path = dir.join("first-q8.adp1.manifest");
        let second_manifest_path = dir.join("second-q8.adp1.manifest");
        fs::write(&first_manifest_path, &first_manifest).unwrap();
        fs::write(&second_manifest_path, &second_manifest).unwrap();
        let first = route_with_apply_status(
            "../models/first-q8.adp1",
            "First q8 ADP1",
            "0x00000000000000aa",
            &first_manifest,
            ADAPTER_APPLY_STATUS_QUANTIZED,
        );
        let second = route_with_apply_status(
            "../models/second-q8.adp1",
            "Second q8 ADP1",
            "0x00000000000000bb",
            &second_manifest,
            ADAPTER_APPLY_STATUS_QUANTIZED,
        );
        let inputs = [
            AdapterFamilyInput {
                route: &first,
                manifest_path: &first_manifest_path,
            },
            AdapterFamilyInput {
                route: &second,
                manifest_path: &second_manifest_path,
            },
        ];
        let receipt_path = dir.join("candidate-q8.adapter-family.receipt");

        write_receipt_path(
            "candidate-a",
            "Candidate q8 ADP1 family",
            "../models/candidate-q8.adapter-family.receipt",
            &receipt_path,
            &inputs,
        )
        .unwrap();

        validate_receipt_path(&receipt_path, &inputs).unwrap();
        let receipt = fs::read_to_string(&receipt_path).unwrap();
        assert!(receipt.contains("family.adapter_base_quantization=q8_0"));
        assert!(receipt.contains("adapter_family_preferred_adapter_index=0"));
        assert!(receipt.contains("adapter.1.apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rejects_identity_drift_between_family_members() {
        let dir = unique_dir("identity-drift");
        fs::create_dir_all(&dir).unwrap();
        let first_manifest = member_manifest("0x00000000000000aa", "0x00000000000000f1");
        let second_manifest = member_manifest("0x00000000000000bb", "0x00000000000000f2");
        let first_manifest_path = dir.join("first.adp1.manifest");
        let second_manifest_path = dir.join("second.adp1.manifest");
        fs::write(&first_manifest_path, &first_manifest).unwrap();
        fs::write(&second_manifest_path, &second_manifest).unwrap();
        let first = route(
            "../models/first.adp1",
            "First ADP1",
            "0x00000000000000aa",
            &first_manifest,
        );
        let second = route(
            "../models/second.adp1",
            "Second ADP1",
            "0x00000000000000bb",
            &second_manifest,
        );
        let inputs = [
            AdapterFamilyInput {
                route: &first,
                manifest_path: &first_manifest_path,
            },
            AdapterFamilyInput {
                route: &second,
                manifest_path: &second_manifest_path,
            },
        ];

        let error = build_receipt_text(
            "candidate-a",
            "Candidate ADP1 family",
            "../models/candidate.adapter-family.receipt",
            &inputs,
        )
        .unwrap_err();

        assert!(error.to_string().contains("adapter_tensor_layout_checksum"));
        fs::remove_dir_all(dir).unwrap();
    }

    fn route(
        adapter_path: &str,
        label: &str,
        artifact_checksum: &str,
        manifest_text: &str,
    ) -> RegistryAdapterRoute {
        route_with_apply_status(
            adapter_path,
            label,
            artifact_checksum,
            manifest_text,
            ADAPTER_APPLY_STATUS_F32,
        )
    }

    fn route_with_apply_status(
        adapter_path: &str,
        label: &str,
        artifact_checksum: &str,
        manifest_text: &str,
        apply_status: &str,
    ) -> RegistryAdapterRoute {
        RegistryAdapterRoute {
            candidate_id: "candidate-a".to_string(),
            adapter_path: adapter_path.to_string(),
            manifest_path: format!("{adapter_path}.manifest"),
            label: label.to_string(),
            apply_status: apply_status.to_string(),
            artifact_checksum: artifact_checksum.to_string(),
            manifest_checksum: hex64(provenance::text_checksum(manifest_text.as_bytes())),
        }
    }

    fn member_manifest(artifact_checksum: &str, layout_checksum: &str) -> String {
        member_manifest_with_quantization(
            artifact_checksum,
            layout_checksum,
            "f32",
            ADAPTER_APPLY_STATUS_F32,
        )
    }

    fn sparse_member_manifest(artifact_checksum: &str, layout_checksum: &str) -> String {
        member_manifest_with_format(
            artifact_checksum,
            layout_checksum,
            "f32",
            ADAPTER_APPLY_STATUS_F32,
            SPARSE_ADAPTER_ARTIFACT_KIND,
            SPARSE_ADAPTER_DTYPE,
        )
    }

    fn member_manifest_with_quantization(
        artifact_checksum: &str,
        layout_checksum: &str,
        base_quantization: &str,
        apply_status: &str,
    ) -> String {
        member_manifest_with_format(
            artifact_checksum,
            layout_checksum,
            base_quantization,
            apply_status,
            ADAPTER_ARTIFACT_KIND,
            ADAPTER_DTYPE,
        )
    }

    fn member_manifest_with_format(
        artifact_checksum: &str,
        layout_checksum: &str,
        base_quantization: &str,
        apply_status: &str,
        artifact_kind: &str,
        dtype: &str,
    ) -> String {
        let mut text = String::new();
        push_line(
            &mut text,
            "tinyrustlm_adapter_artifact_version",
            ADAPTER_ARTIFACT_VERSION,
        );
        push_line(&mut text, "adapter_artifact_kind", artifact_kind);
        push_line(&mut text, "adapter_status", ADAPTER_STATUS);
        push_line(&mut text, "adapter_artifact_checksum", artifact_checksum);
        push_line(&mut text, "adapter_tensor_count", "12");
        push_line(&mut text, "adapter_parameter_count", "1024");
        push_line(&mut text, "adapter_dtype", dtype);
        push_line(&mut text, "adapter_model_shape", "tiny-fixture");
        push_line(&mut text, "adapter_base_quantization", base_quantization);
        push_line(&mut text, "adapter_output_contract", "untied-output");
        push_line(
            &mut text,
            "adapter_tokenizer_checksum",
            "0x00000000000000e1",
        );
        push_line(&mut text, "adapter_tensor_layout_checksum", layout_checksum);
        push_line(
            &mut text,
            "adapter_base_contract",
            "matches-parent-direct-parameter-contract",
        );
        push_line(&mut text, "adapter_apply_status", apply_status);
        text
    }

    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-adapter-family-{label}-{nanos}"))
    }
}
