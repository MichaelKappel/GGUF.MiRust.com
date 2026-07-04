//! CLI coverage for the native TinyRustLM eval runner.

use std::path::{Path, PathBuf};
use std::process::Command;

fn eval_bin() -> &'static str {
    env!("CARGO_BIN_EXE_tinyrustlm-eval")
}

#[test]
fn tinyrustlm_eval_cli_writes_passed_eval_sidecar() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8.eval");
    let _ = std::fs::remove_file(&output_eval);

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run tinyrustlm-eval");

    assert!(output.status.success(), "{}", output_text(&output));
    let text = output_text(&output);
    assert!(text.contains("TinyRustLM eval cases: PASS"));
    assert!(text.contains("cases_passed: 2"));
    assert!(text.contains("cases_failed: 0"));

    let sidecar = std::fs::read_to_string(&output_eval).expect("read eval sidecar");
    assert!(sidecar.contains("tinyrustlm_eval_manifest_version=1"));
    assert!(sidecar.contains("gate=assistant-quality"));
    assert!(sidecar.contains("eval_status=pass"));
    assert!(sidecar.contains("task_eval_status=pass"));
    assert!(sidecar.contains("case_count=2"));
    assert!(sidecar.contains("cases_passed=2"));
    assert!(sidecar.contains("cases_failed=0"));
}

fn temp_output(name: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("tinyrustlm-eval-cli-{nanos}-{name}"))
}

fn output_text(output: &std::process::Output) -> String {
    format!(
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}
