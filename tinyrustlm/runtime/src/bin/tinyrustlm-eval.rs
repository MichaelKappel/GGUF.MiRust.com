//! Native TinyRustLM eval runner.

use std::env;
use std::path::Path;

use tinyrustlm_runtime::eval_runner::run_eval_to_sidecar;

fn main() {
    if let Err(error) = run() {
        eprintln!("tinyrustlm-eval: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 {
        print_usage();
        return Err("expected model, manifest, eval cases, and output eval paths".to_string());
    }
    let outcome = run_eval_to_sidecar(
        Path::new(&args[1]),
        Path::new(&args[2]),
        Path::new(&args[3]),
        Path::new(&args[4]),
    )
    .map_err(|error| error.to_string())?;
    println!(
        "TinyRustLM eval cases: {}",
        if outcome.passed { "PASS" } else { "FAIL" }
    );
    println!("cases_passed: {}", outcome.cases_passed);
    println!("cases_failed: {}", outcome.cases_failed);
    println!("output_eval: {}", args[4]);
    if outcome.passed {
        Ok(())
    } else {
        Err("one or more eval cases failed".to_string())
    }
}

fn print_usage() {
    eprintln!(
        "usage: tinyrustlm-eval <model.slm> <model.slm.manifest> <eval-cases.txt> <output.eval>"
    );
}
