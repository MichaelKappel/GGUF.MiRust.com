//! Public CLI coverage for GGUF inspection intake.

use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn pack_bin() -> &'static str {
    env!("CARGO_BIN_EXE_tinyrustlm-slm-pack")
}

fn unique_dir(name: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after UNIX_EPOCH")
        .as_millis();
    std::env::temp_dir().join(format!(
        "tinyrustlm-slm-pack-{name}-{}-{millis}",
        std::process::id()
    ))
}

fn output_text(output: &std::process::Output) -> String {
    format!(
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

#[test]
fn inspect_gguf_cli_writes_bounded_directory_report() {
    let dir = unique_dir("gguf-cli");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");
    let fixture = dir.join("tiny-fixture.gguf");
    let report = dir.join("tiny-fixture.gguf.inspect");
    let fixture_text = fixture.to_string_lossy().to_string();
    let report_text = report.to_string_lossy().to_string();

    let write_output = Command::new(pack_bin())
        .args(["write-gguf-fixture", &fixture_text])
        .output()
        .expect("run write-gguf-fixture");
    assert!(
        write_output.status.success(),
        "{}",
        output_text(&write_output)
    );
    assert!(fixture.exists());

    let inspect_output = Command::new(pack_bin())
        .args(["inspect-gguf", &fixture_text, &report_text])
        .output()
        .expect("run inspect-gguf");
    assert!(
        inspect_output.status.success(),
        "{}",
        output_text(&inspect_output)
    );
    let cli_text = output_text(&inspect_output);
    assert!(cli_text.contains("GGUF inspection: PASS"));
    assert!(cli_text.contains("gguf_version: 3"));
    assert!(cli_text.contains("tensor_count: 2"));
    assert!(cli_text.contains("tensor_data_bytes: 48"));

    let report_text = std::fs::read_to_string(&report).expect("read GGUF inspection report");
    assert!(report_text.contains("tinyrustlm_gguf_inspection_version=1"));
    assert!(report_text.contains("source_layout=gguf-v3"));
    assert!(report_text.contains("architecture=tinyrustlm-fixture"));
    assert!(report_text.contains("model_name=TinyRustLM GGUF fixture"));
    assert!(report_text.contains("type.0.name=F16"));
    assert!(report_text.contains("type.1.name=F32"));
    assert!(report_text.contains("tensor.0.name=token_embd.weight"));
    assert!(report_text.contains("tensor.0.absolute_start="));
    assert!(report_text.contains("tensor.1.name=output.weight"));
    assert!(report_text.contains("tensor.1.type=F16"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn convert_gguf_trained_cli_writes_valid_slm() {
    let dir = unique_dir("gguf-conversion-cli");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");
    let fixture = dir.join("tiny-source.gguf");
    let plan = dir.join("tiny-source.gguf.plan");
    let source_dir = dir.join("raw-source");
    let output_slm = dir.join("tiny-source-q8.slm");
    let fixture_text = fixture.to_string_lossy().to_string();
    let plan_text = plan.to_string_lossy().to_string();
    let source_dir_text = source_dir.to_string_lossy().to_string();
    let output_slm_text = output_slm.to_string_lossy().to_string();

    let write_output = Command::new(pack_bin())
        .args(["write-gguf-source-fixture", &fixture_text, "tiny-fixture"])
        .output()
        .expect("run write-gguf-source-fixture");
    assert!(
        write_output.status.success(),
        "{}",
        output_text(&write_output)
    );
    assert!(fixture.exists());

    let plan_output = Command::new(pack_bin())
        .args([
            "plan-gguf-source",
            &fixture_text,
            "tiny-fixture",
            &plan_text,
        ])
        .output()
        .expect("run plan-gguf-source");
    assert!(
        plan_output.status.success(),
        "{}",
        output_text(&plan_output)
    );
    let plan_cli_text = output_text(&plan_output);
    assert!(plan_cli_text.contains("GGUF source plan: PASS"));
    assert!(plan_cli_text.contains("matched_tensor_count: 12"));
    let plan_text = std::fs::read_to_string(&plan).expect("read GGUF source plan");
    assert!(plan_text.contains("tinyrustlm_gguf_source_plan_version=1"));
    assert!(plan_text.contains("conversion_status=copy-ready"));
    assert!(plan_text.contains("tensor.0.gguf_name=token_embd.weight"));
    assert!(plan_text.contains("tensor.3.gguf_name=blk.0.attn_norm.weight"));

    let convert_output = Command::new(pack_bin())
        .args([
            "convert-gguf-trained",
            &fixture_text,
            "tiny-fixture",
            &source_dir_text,
            &output_slm_text,
            "q8_0",
        ])
        .output()
        .expect("run convert-gguf-trained");
    assert!(
        convert_output.status.success(),
        "{}",
        output_text(&convert_output)
    );
    let convert_text = output_text(&convert_output);
    assert!(convert_text.contains("GGUF source extraction: PASS"));
    assert!(convert_text.contains("SLM source validation: PASS"));
    assert!(convert_text.contains("SLM converted trained source written"));
    assert!(convert_text.contains("GGUF trained conversion: PASS"));
    assert!(source_dir.join("source.manifest").exists());
    assert!(output_slm.exists());
    assert!(dir.join("tiny-source-q8.slm.manifest").exists());

    let validate_output = Command::new(pack_bin())
        .args(["validate", &output_slm_text])
        .output()
        .expect("run validate on converted GGUF slm");
    assert!(
        validate_output.status.success(),
        "{}",
        output_text(&validate_output)
    );

    let _ = std::fs::remove_dir_all(dir);
}
