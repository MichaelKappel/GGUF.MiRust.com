//! Native eval-case runner for TinyRustLM artifacts.

use crate::errors::ErrorCode;
use crate::generate::Runtime;
use crate::model_format::{parse_slm, SlmHeader};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

const EVAL_CASES_VERSION: &str = "1";
const EVAL_MANIFEST_VERSION: &str = "1";
const GATE_ASSISTANT_QUALITY: &str = "assistant-quality";

/// Summary returned after running a local eval case file.
pub struct EvalOutcome {
    /// Whether all declared cases passed.
    pub passed: bool,
    /// Number of cases that matched their expected output.
    pub cases_passed: usize,
    /// Number of cases that failed generation or exact matching.
    pub cases_failed: usize,
}

#[derive(Debug)]
struct EvalCase {
    prompt: String,
    max_new_tokens: u32,
    expected_text: String,
}

#[derive(Debug)]
struct EvalCases {
    scope: String,
    quality_boundary: String,
    safety_review_status: String,
    quality_decision: String,
    evaluator: String,
    eval_summary: String,
    cases: Vec<EvalCase>,
}

struct CaseResult {
    expected: String,
    actual: String,
    passed: bool,
    error: String,
}

/// Runs a local model against eval cases and writes a quality-gate sidecar.
pub fn run_eval_to_sidecar(
    model_path: &Path,
    manifest_path: &Path,
    cases_path: &Path,
    output_path: &Path,
) -> io::Result<EvalOutcome> {
    let model_bytes = fs::read(model_path)?;
    let parsed = parse_slm(&model_bytes).map_err(error_to_io)?;
    let manifest_text = fs::read_to_string(manifest_path)?;
    let manifest_fields = parse_key_value(&manifest_text)?;
    let source_kind = require_nonempty(&manifest_fields, "source_kind")?;
    let cases_text = fs::read_to_string(cases_path)?;
    let eval_cases = parse_eval_cases(&cases_text)?;

    let mut runtime = Runtime::new();
    let load_code = runtime.load_model(&model_bytes);
    if load_code != ErrorCode::Ok {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("model load failed: {}", load_code.message()),
        ));
    }

    let mut results = Vec::with_capacity(eval_cases.cases.len());
    let mut cases_passed = 0usize;
    for case in &eval_cases.cases {
        runtime.reset_context();
        let code = runtime.generate(&case.prompt, case.max_new_tokens);
        if code == ErrorCode::Ok {
            let actual = std::str::from_utf8(runtime.last_result())
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "result was not UTF-8"))?
                .to_string();
            let passed = actual == case.expected_text;
            if passed {
                cases_passed += 1;
            }
            results.push(CaseResult {
                expected: case.expected_text.clone(),
                actual,
                passed,
                error: "ok".to_string(),
            });
        } else {
            results.push(CaseResult {
                expected: case.expected_text.clone(),
                actual: String::new(),
                passed: false,
                error: code.message().to_string(),
            });
        }
    }

    let cases_failed = eval_cases.cases.len().saturating_sub(cases_passed);
    let passed = cases_failed == 0;
    let sidecar = build_eval_sidecar(
        &parsed.header,
        source_kind,
        &manifest_text,
        cases_path,
        &eval_cases,
        &results,
        passed,
    );
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, sidecar)?;

    Ok(EvalOutcome {
        passed,
        cases_passed,
        cases_failed,
    })
}

fn parse_eval_cases(text: &str) -> io::Result<EvalCases> {
    let fields = parse_key_value(text)?;
    require_equal(&fields, "tinyrustlm_eval_cases_version", EVAL_CASES_VERSION)?;
    let scope = require_nonempty(&fields, "scope")?.to_string();
    let quality_boundary = require_nonempty(&fields, "quality_boundary")?.to_string();
    let safety_review_status = require_nonempty(&fields, "safety_review_status")?.to_string();
    let quality_decision = require_nonempty(&fields, "quality_decision")?.to_string();
    let evaluator = require_nonempty(&fields, "evaluator")?.to_string();
    let eval_summary = require_nonempty(&fields, "eval_summary")?.to_string();
    let case_count = parse_usize(require_nonempty(&fields, "case_count")?, "case_count")?;
    if case_count == 0 {
        return Err(invalid("case_count must be greater than zero"));
    }
    let mut cases = Vec::with_capacity(case_count);
    for index in 0..case_count {
        let prefix = format!("case.{index}");
        require_equal(&fields, &format!("{prefix}.required_result"), "exact")?;
        let prompt = require_nonempty(&fields, &format!("{prefix}.prompt"))?.to_string();
        let max_new_tokens = parse_u32(
            require_nonempty(&fields, &format!("{prefix}.max_new_tokens"))?,
            &format!("{prefix}.max_new_tokens"),
        )?;
        if max_new_tokens == 0 {
            return Err(invalid("case max_new_tokens must be greater than zero"));
        }
        let expected_text =
            require_nonempty(&fields, &format!("{prefix}.expected_text"))?.to_string();
        cases.push(EvalCase {
            prompt,
            max_new_tokens,
            expected_text,
        });
    }
    reject_extra_case_keys(&fields, case_count)?;
    Ok(EvalCases {
        scope,
        quality_boundary,
        safety_review_status,
        quality_decision,
        evaluator,
        eval_summary,
        cases,
    })
}

fn build_eval_sidecar(
    header: &SlmHeader,
    source_kind: &str,
    manifest_text: &str,
    cases_path: &Path,
    eval_cases: &EvalCases,
    results: &[CaseResult],
    passed: bool,
) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_eval_manifest_version",
        EVAL_MANIFEST_VERSION,
    );
    push_line(&mut text, "gate", GATE_ASSISTANT_QUALITY);
    push_line(&mut text, "source_kind", source_kind);
    push_line(
        &mut text,
        "manifest_checksum",
        &format!("0x{:016x}", text_checksum(manifest_text.as_bytes())),
    );
    push_line(
        &mut text,
        "slm_checksum",
        &format!("0x{:016x}", header.checksum),
    );
    push_line(&mut text, "model_shape", &shape_summary(header));
    if passed {
        push_line(&mut text, "eval_status", "pass");
        push_line(&mut text, "task_eval_status", "pass");
        push_line(
            &mut text,
            "safety_review_status",
            &eval_cases.safety_review_status,
        );
        push_line(&mut text, "quality_decision", &eval_cases.quality_decision);
    } else {
        push_line(&mut text, "eval_status", "fail");
        push_line(&mut text, "task_eval_status", "fail");
        push_line(&mut text, "safety_review_status", "pending");
        push_line(&mut text, "quality_decision", "pending");
    }
    push_line(&mut text, "quality_scope", &eval_cases.scope);
    push_line(&mut text, "evaluator", &eval_cases.evaluator);
    push_line(&mut text, "eval_dataset", &cases_path.display().to_string());
    push_line(&mut text, "eval_summary", &eval_cases.eval_summary);
    push_line(&mut text, "quality_boundary", &eval_cases.quality_boundary);
    push_line(&mut text, "case_count", &results.len().to_string());
    push_line(
        &mut text,
        "cases_passed",
        &results
            .iter()
            .filter(|result| result.passed)
            .count()
            .to_string(),
    );
    push_line(
        &mut text,
        "cases_failed",
        &results
            .iter()
            .filter(|result| !result.passed)
            .count()
            .to_string(),
    );
    for (index, result) in results.iter().enumerate() {
        let prefix = format!("case.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.status"),
            if result.passed { "pass" } else { "fail" },
        );
        push_line(&mut text, &format!("{prefix}.expected"), &result.expected);
        push_line(&mut text, &format!("{prefix}.actual"), &result.actual);
        push_line(&mut text, &format!("{prefix}.error"), &result.error);
    }
    text
}

fn shape_summary(header: &SlmHeader) -> String {
    format!(
        "vocab={},hidden={},layers={},heads={},kv_heads={},head_dim={},ffn={},context={}",
        header.vocab_size,
        header.hidden_size,
        header.layer_count,
        header.head_count,
        header.kv_head_count,
        header.head_dim,
        header.ffn_size,
        header.max_context
    )
}

fn parse_key_value(text: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!("line {} is missing '='", line_index + 1)));
        };
        let key = key.trim();
        if key.is_empty() {
            return Err(invalid(&format!(
                "line {} has an empty key",
                line_index + 1
            )));
        }
        if fields
            .insert(key.to_string(), value.trim().to_string())
            .is_some()
        {
            return Err(invalid(&format!("duplicate key {key}")));
        }
    }
    Ok(fields)
}

fn reject_extra_case_keys(fields: &HashMap<String, String>, case_count: usize) -> io::Result<()> {
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("case.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("case key {key} is malformed")));
            };
            let index = parse_usize(index_text, key)?;
            if index >= case_count {
                return Err(invalid(&format!(
                    "case key {key} is outside declared case_count"
                )));
            }
            match field_name {
                "prompt" | "max_new_tokens" | "expected_text" | "required_result" => {}
                _ => return Err(invalid(&format!("case key {key} has unknown field"))),
            }
        }
    }
    Ok(())
}

fn require_value<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("missing required key {key}")))
}

fn require_nonempty<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    let value = require_value(fields, key)?;
    if value.is_empty() {
        return Err(invalid(&format!("key {key} must not be empty")));
    }
    Ok(value)
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_nonempty(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn parse_u32(value: &str, key: &str) -> io::Result<u32> {
    value
        .parse::<u32>()
        .map_err(|_| invalid(&format!("key {key} must be a u32")))
}

fn parse_usize(value: &str, key: &str) -> io::Result<usize> {
    value
        .parse::<usize>()
        .map_err(|_| invalid(&format!("key {key} must be a usize")))
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(&line_value(value));
    text.push('\n');
}

fn line_value(value: &str) -> String {
    value.replace(['\r', '\n'], " ")
}

fn text_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x4d595df4d0f33173u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

fn error_to_io(error: ErrorCode) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, error.message())
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_eval_cases() {
        let cases = parse_eval_cases(
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture evidence only\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=All cases are exact fixture checks\ncase_count=1\ncase.0.prompt=hi\ncase.0.max_new_tokens=1\ncase.0.expected_text=e\ncase.0.required_result=exact\n",
        )
        .unwrap();

        assert_eq!(cases.cases.len(), 1);
        assert_eq!(cases.cases[0].prompt, "hi");
        assert_eq!(cases.cases[0].expected_text, "e");
    }

    #[test]
    fn rejects_invalid_required_result() {
        let error = parse_eval_cases(
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture evidence only\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=All cases are exact fixture checks\ncase_count=1\ncase.0.prompt=hi\ncase.0.max_new_tokens=1\ncase.0.expected_text=e\ncase.0.required_result=contains\n",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_zero_case_eval_files() {
        let error = parse_eval_cases(
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture evidence only\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=All cases are exact fixture checks\ncase_count=0\n",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_case_keys_outside_declared_count() {
        let error = parse_eval_cases(
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture evidence only\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=All cases are exact fixture checks\ncase_count=1\ncase.0.prompt=hi\ncase.0.max_new_tokens=1\ncase.0.expected_text=e\ncase.0.required_result=exact\ncase.1.prompt=extra\n",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }
}
