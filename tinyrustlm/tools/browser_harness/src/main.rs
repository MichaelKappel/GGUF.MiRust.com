#![forbid(unsafe_code)]
#![doc = "No-crate TinyRustLM mini browser contract harness."]

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Component, Path, PathBuf};
use std::process::ExitCode;
use std::thread;
use std::time::Duration;

const DEFAULT_ROOT: &str = "tinyrustlm";
const PRIVACY_NOTICE: &str =
    "All inference runs locally in this browser. Prompts are not sent to a server.";

const REQUIRED_IDS: &[&str] = &[
    "runtimeStatus",
    "chatForm",
    "prompt",
    "maxTokens",
    "temperature",
    "topK",
    "topP",
    "seed",
    "generateButton",
    "stepTokenButton",
    "resetButton",
    "clearChatButton",
    "conversation",
    "response",
    "modelSelect",
    "loadPanel",
    "wasmState",
    "modelState",
    "errorState",
    "provenancePanel",
    "provenanceState",
    "provenanceSourceKind",
    "provenanceAdmission",
    "provenanceQualityClaim",
    "provenanceTrainedClaim",
    "provenanceChecksum",
    "provenanceNextGate",
    "benchLoadMs",
    "benchPromptTokens",
    "benchGeneratedTokens",
    "benchTokensPerSecond",
    "benchScratch",
    "diagnostics",
    "console",
    "developer",
    "appFooter",
];

const REQUIRED_HTML_TEXT: &[&str] = &[
    "TinyRustLM",
    "GGUF.MiRust.com",
    "Runtime Diagnostics",
    "Token Generation Console",
    "Developer Mode",
    "Model Provenance",
    "Conversation",
    "Local .slm models only",
    PRIVACY_NOTICE,
];

const REQUIRED_JS_EXPORTS: &[&str] = &[
    ".alloc(",
    ".dealloc(",
    ".init_runtime(",
    ".load_model(",
    ".generate(",
    ".generate_next_token(",
    ".last_result_ptr(",
    ".last_result_len(",
    ".get_diagnostics_ptr(",
    ".get_diagnostics_len(",
    ".reset_context(",
    ".set_sampling_config(",
];

const REQUIRED_WASM_EXPORTS: &[&str] = &[
    "alloc",
    "dealloc",
    "init_runtime",
    "load_model",
    "generate",
    "set_sampling_config",
    "generate_next_token",
    "last_result_ptr",
    "last_result_len",
    "get_diagnostics_ptr",
    "get_diagnostics_len",
    "reset_context",
    "free_model",
];

const REQUIRED_MODEL_ROUTES: &[(&str, &str, &str)] = &[
    ("tinylm16q8", "../models/tinylm16-q8.slm", "q8_0"),
    ("tinylm16q4", "../models/tinylm16-q4.slm", "q4_0"),
    ("tinylm16f32", "../models/tinylm16-f32.slm", "f32"),
    ("tinyf32", "../models/tiny-test-model.slm", "f32"),
    ("tinytied", "../models/tiny-test-model-tied.slm", "f32"),
    ("tinyq8", "../models/tiny-test-model-q8.slm", "q8_0"),
    ("tinyq4", "../models/tiny-test-model-q4.slm", "q4_0"),
    ("tinybpe", "../models/tiny-test-model-bpe.slm", "f32"),
];

const REQUIRED_MANIFEST_KEYS: &[&str] = &[
    "tinyrustlm_slm_manifest_version",
    "model_path",
    "model_bytes",
    "slm_version",
    "slm_checksum",
    "model_shape",
    "tensor_count",
    "parameter_count",
    "quantization",
    "source_kind",
    "quality_claim",
    "trained_quality_claim",
    "admission_status",
    "required_next_gate",
];

const FORBIDDEN_REMOTE_MARKERS: &[&str] = &[
    "http://",
    "https://",
    "//cdn",
    "unpkg",
    "jsdelivr",
    "cdnjs",
    "googleapis",
    "telemetry",
    "analytics",
];

fn main() -> ExitCode {
    match run() {
        Ok(report) => {
            println!("{report}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("TinyRustLM browser harness failed: {error}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<String, HarnessError> {
    let config = Config::from_args(env::args().skip(1))?;
    let root = config.root.canonicalize().map_err(|source| {
        HarnessError::InvalidInput(format!("root {}: {source}", config.root.display()))
    })?;
    let mut checks = Vec::new();
    audit_static_contract(&root, &mut checks)?;
    if let Some(url) = &config.http_app_url {
        audit_http_contract(url, &mut checks)?;
    }
    Ok(format!(
        "TinyRustLM browser harness passed: {} checks; root={}; http={}",
        checks.len(),
        root.display(),
        config.http_app_url.as_deref().unwrap_or("not-requested")
    ))
}

#[derive(Debug)]
struct Config {
    root: PathBuf,
    http_app_url: Option<String>,
}

impl Config {
    fn from_args<I>(args: I) -> Result<Self, HarnessError>
    where
        I: Iterator<Item = String>,
    {
        let mut root = PathBuf::from(DEFAULT_ROOT);
        let mut http_app_url = None;
        let mut positional_root_seen = false;
        let mut args = args.peekable();

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--http" => {
                    let Some(value) = args.next() else {
                        return Err(HarnessError::InvalidInput(
                            "--http requires an app URL".to_string(),
                        ));
                    };
                    http_app_url = Some(value);
                }
                "--help" | "-h" => {
                    return Err(HarnessError::InvalidInput(
                        "usage: tinyrustlm-browser-harness [root] [--http http://127.0.0.1:8080/app/]".to_string(),
                    ));
                }
                value if value.starts_with('-') => {
                    return Err(HarnessError::InvalidInput(format!(
                        "unexpected option '{value}'"
                    )));
                }
                value => {
                    if positional_root_seen {
                        return Err(HarnessError::InvalidInput(format!(
                            "unexpected extra root '{value}'"
                        )));
                    }
                    root = PathBuf::from(value);
                    positional_root_seen = true;
                }
            }
        }

        Ok(Self { root, http_app_url })
    }
}

#[derive(Debug)]
enum HarnessError {
    InvalidInput(String),
    Missing(String),
    Io(std::io::Error),
    Http(String),
}

impl std::fmt::Display for HarnessError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HarnessError::InvalidInput(message) => write!(formatter, "invalid input: {message}"),
            HarnessError::Missing(message) => write!(formatter, "missing contract: {message}"),
            HarnessError::Io(source) => write!(formatter, "{source}"),
            HarnessError::Http(message) => write!(formatter, "http check failed: {message}"),
        }
    }
}

impl From<std::io::Error> for HarnessError {
    fn from(source: std::io::Error) -> Self {
        HarnessError::Io(source)
    }
}

fn audit_static_contract(root: &Path, checks: &mut Vec<String>) -> Result<(), HarnessError> {
    let index = read_utf8(root.join("app").join("index.html"))?;
    let js = read_utf8(root.join("app").join("app.js"))?;
    let css = read_utf8(root.join("app").join("app.css"))?;
    let wasm_exports = read_utf8(root.join("runtime").join("src").join("wasm_exports.rs"))?;

    require_no_remote_markers("index.html", &index)?;
    require_no_remote_markers("app.js", &js)?;
    require_no_remote_markers("app.css", &css)?;
    checks.push("static files contain no remote markers".to_string());

    for id in REQUIRED_IDS {
        require_contains("index.html id", &index, &format!("id=\"{id}\""))?;
    }
    checks.push(format!("{} required UI ids", REQUIRED_IDS.len()));

    for text in REQUIRED_HTML_TEXT {
        require_contains("index.html text", &index, text)?;
    }
    checks.push(format!(
        "{} required visible text markers",
        REQUIRED_HTML_TEXT.len()
    ));

    require_contains("index.html stylesheet", &index, "href=\"./app.css\"")?;
    require_contains("index.html script", &index, "src=\"./app.js\"")?;
    checks.push("html asset links".to_string());

    require_contains("app.js wasm path", &js, "../runtime/tinyrustlm.wasm")?;
    require_contains("app.js wasm instantiate", &js, "WebAssembly.instantiate")?;
    require_contains("app.js local fetch", &js, "fetch(")?;
    require_contains("app.js manifest fetch", &js, "model.path")?;
    require_contains("app.js manifest fetch", &js, ".manifest")?;
    for export in REQUIRED_JS_EXPORTS {
        require_contains("app.js wasm export", &js, export)?;
    }
    checks.push(format!(
        "{} required WASM boundary calls",
        REQUIRED_JS_EXPORTS.len()
    ));

    for export in REQUIRED_WASM_EXPORTS {
        require_wasm_export(&wasm_exports, export)?;
    }
    checks.push(format!(
        "{} required Rust WASM exports",
        REQUIRED_WASM_EXPORTS.len()
    ));

    for (key, route, quantization) in REQUIRED_MODEL_ROUTES {
        require_contains(
            "index.html model option",
            &index,
            &format!("value=\"{key}\""),
        )?;
        require_contains("app.js model route", &js, route)?;
        audit_model_and_manifest(root, route, quantization)?;
    }
    checks.push(format!(
        "{} local model routes and manifests",
        REQUIRED_MODEL_ROUTES.len()
    ));

    require_contains("app.css responsive behavior", &css, "@media")?;
    require_contains("app.css status error state", &css, ".error")?;
    require_contains("app.css shell layout", &css, ".shell")?;
    checks.push("css layout and error-state markers".to_string());

    Ok(())
}

fn audit_model_and_manifest(
    root: &Path,
    app_relative_route: &str,
    expected_quantization: &str,
) -> Result<(), HarnessError> {
    let model_path = resolve_app_relative(root, app_relative_route)?;
    let manifest_path = PathBuf::from(format!("{}.manifest", model_path.display()));
    if !model_path.is_file() {
        return Err(HarnessError::Missing(format!(
            "model file {}",
            model_path.display()
        )));
    }
    if !manifest_path.is_file() {
        return Err(HarnessError::Missing(format!(
            "manifest file {}",
            manifest_path.display()
        )));
    }

    let manifest_text = read_utf8(&manifest_path)?;
    require_no_remote_markers("manifest", &manifest_text)?;
    let fields = parse_manifest(&manifest_text);
    for key in REQUIRED_MANIFEST_KEYS {
        if !fields.contains_key(*key) {
            return Err(HarnessError::Missing(format!(
                "manifest key {key} in {}",
                manifest_path.display()
            )));
        }
    }
    require_manifest_value(&fields, "quantization", expected_quantization)?;
    require_manifest_value(&fields, "trained_quality_claim", "not-claimed")?;
    require_manifest_value(
        &fields,
        "required_next_gate",
        "replace-with-trained-or-evaluated-model-before-product-quality-claim",
    )?;
    let model_bytes = fs::metadata(&model_path)?.len().to_string();
    require_manifest_value(&fields, "model_bytes", &model_bytes)?;
    Ok(())
}

fn resolve_app_relative(root: &Path, route: &str) -> Result<PathBuf, HarnessError> {
    if route.contains('\\') || route.contains(':') || route.starts_with('/') {
        return Err(HarnessError::InvalidInput(format!(
            "unsafe app route '{route}'"
        )));
    }
    let app_root = root.join("app");
    let mut out = app_root;
    for part in route.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if !out.pop() {
                    return Err(HarnessError::InvalidInput(format!(
                        "route escapes root '{route}'"
                    )));
                }
            }
            value => out.push(value),
        }
    }
    let canonical_root = root.canonicalize()?;
    let parent = out.parent().unwrap_or(root);
    let canonical_parent = parent.canonicalize()?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err(HarnessError::InvalidInput(format!(
            "route escapes root '{route}'"
        )));
    }
    Ok(out)
}

fn audit_http_contract(app_url: &str, checks: &mut Vec<String>) -> Result<(), HarnessError> {
    let parsed = HttpUrl::parse(app_url)?;
    if !parsed.path.ends_with("/app/") {
        return Err(HarnessError::Http(format!(
            "app URL must end in /app/, got {}",
            parsed.path
        )));
    }

    let routes = [
        ("GET", "/app/", "text/html"),
        ("HEAD", "/app/app.css", "text/css"),
        ("HEAD", "/app/app.js", "text/javascript"),
        ("HEAD", "/runtime/tinyrustlm.wasm", "application/wasm"),
        (
            "HEAD",
            "/models/tinylm16-q8.slm",
            "application/octet-stream",
        ),
        ("HEAD", "/models/tinylm16-q8.slm.manifest", "text/plain"),
    ];

    for (method, path, content_type) in routes {
        let response = http_request(&parsed.host, parsed.port, method, path)?;
        if response.status != 200 {
            return Err(HarnessError::Http(format!(
                "{method} {path} returned {}",
                response.status
            )));
        }
        let actual_type = response
            .headers
            .get("content-type")
            .map(String::as_str)
            .unwrap_or("");
        if !actual_type.starts_with(content_type) {
            return Err(HarnessError::Http(format!(
                "{method} {path} content-type '{actual_type}' did not start with '{content_type}'"
            )));
        }
        if method == "GET" {
            let body = String::from_utf8_lossy(&response.body);
            require_contains("http app body", &body, "<title>TinyRustLM</title>")?;
            require_contains("http app body", &body, PRIVACY_NOTICE)?;
        }
    }
    checks.push("loopback HTTP app, asset, WASM, model, and manifest routes".to_string());
    Ok(())
}

#[derive(Debug, Eq, PartialEq)]
struct HttpUrl {
    host: String,
    port: u16,
    path: String,
}

impl HttpUrl {
    fn parse(input: &str) -> Result<Self, HarnessError> {
        let Some(rest) = input.strip_prefix("http://") else {
            return Err(HarnessError::Http(
                "only http:// loopback URLs are supported".to_string(),
            ));
        };
        let slash = rest
            .find('/')
            .ok_or_else(|| HarnessError::Http("missing URL path".to_string()))?;
        let authority = &rest[..slash];
        let path = &rest[slash..];
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port_text)) => {
                let port = port_text
                    .parse::<u16>()
                    .map_err(|_| HarnessError::Http(format!("invalid port '{port_text}'")))?;
                (host.to_string(), port)
            }
            None => (authority.to_string(), 80),
        };
        if host != "127.0.0.1" && host != "localhost" {
            return Err(HarnessError::Http(format!(
                "non-loopback host '{host}' is forbidden"
            )));
        }
        Ok(Self {
            host,
            port,
            path: path.to_string(),
        })
    }
}

#[derive(Debug)]
struct HttpResponse {
    status: u16,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

fn http_request(
    host: &str,
    port: u16,
    method: &str,
    path: &str,
) -> Result<HttpResponse, HarnessError> {
    let mut last_socket_error = None;
    for _attempt in 0..3 {
        match http_request_once(host, port, method, path) {
            Ok(response) => return Ok(response),
            Err(HarnessError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted
                ) =>
            {
                last_socket_error = Some(error.to_string());
                thread::sleep(Duration::from_millis(75));
            }
            Err(error) => return Err(error),
        }
    }
    Err(HarnessError::Http(format!(
        "{method} {path} loopback socket closed repeatedly: {}",
        last_socket_error.unwrap_or_else(|| "unknown socket error".to_string())
    )))
}

fn http_request_once(
    host: &str,
    port: u16,
    method: &str,
    path: &str,
) -> Result<HttpResponse, HarnessError> {
    let mut stream = TcpStream::connect((host, port)).map_err(|source| {
        HarnessError::Http(format!(
            "connect {host}:{port} for {method} {path}: {source}"
        ))
    })?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    let request =
        format!("{method} {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes())?;
    stream.flush()?;

    let mut bytes = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(len) => bytes.extend_from_slice(&buffer[..len]),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted
                ) && !bytes.is_empty() =>
            {
                break;
            }
            Err(error) => return Err(HarnessError::Io(error)),
        }
    }
    parse_http_response(&bytes)
}

fn parse_http_response(bytes: &[u8]) -> Result<HttpResponse, HarnessError> {
    let split = find_header_split(bytes)
        .ok_or_else(|| HarnessError::Http("response missing header terminator".to_string()))?;
    let headers_text = String::from_utf8_lossy(&bytes[..split]);
    let body = bytes[split + 4..].to_vec();
    let mut lines = headers_text.lines();
    let status_line = lines
        .next()
        .ok_or_else(|| HarnessError::Http("missing response status".to_string()))?;
    let mut status_parts = status_line.split_whitespace();
    let version = status_parts.next().unwrap_or("");
    if !version.starts_with("HTTP/") {
        return Err(HarnessError::Http(format!(
            "invalid status line '{status_line}'"
        )));
    }
    let status = status_parts
        .next()
        .ok_or_else(|| HarnessError::Http("missing status code".to_string()))?
        .parse::<u16>()
        .map_err(|_| HarnessError::Http(format!("invalid status line '{status_line}'")))?;

    let mut headers = BTreeMap::new();
    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            headers.insert(
                key.trim().to_ascii_lowercase(),
                value.trim().to_ascii_lowercase(),
            );
        }
    }
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

fn find_header_split(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_manifest(text: &str) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            fields.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    fields
}

fn read_utf8(path: impl AsRef<Path>) -> Result<String, HarnessError> {
    let path = path.as_ref();
    fs::read_to_string(path).map_err(|source| {
        if source.kind() == std::io::ErrorKind::NotFound {
            HarnessError::Missing(format!("file {}", path.display()))
        } else {
            HarnessError::Io(source)
        }
    })
}

fn require_contains(label: &str, haystack: &str, needle: &str) -> Result<(), HarnessError> {
    if haystack.contains(needle) {
        Ok(())
    } else {
        Err(HarnessError::Missing(format!("{label} '{needle}'")))
    }
}

fn require_wasm_export(source: &str, name: &str) -> Result<(), HarnessError> {
    let safe_export = format!("pub extern \"C\" fn {name}");
    let unsafe_export = format!("pub unsafe extern \"C\" fn {name}");
    if source.contains(&safe_export) || source.contains(&unsafe_export) {
        Ok(())
    } else {
        Err(HarnessError::Missing(format!(
            "wasm_exports.rs export '{name}'"
        )))
    }
}

fn require_no_remote_markers(label: &str, text: &str) -> Result<(), HarnessError> {
    let lowered = text.to_ascii_lowercase();
    for marker in FORBIDDEN_REMOTE_MARKERS {
        if lowered.contains(marker) {
            return Err(HarnessError::Missing(format!(
                "{label} contains forbidden remote marker '{marker}'"
            )));
        }
    }
    Ok(())
}

fn require_manifest_value(
    fields: &BTreeMap<String, String>,
    key: &str,
    expected: &str,
) -> Result<(), HarnessError> {
    match fields.get(key) {
        Some(actual) if actual == expected => Ok(()),
        Some(actual) => Err(HarnessError::Missing(format!(
            "manifest {key} expected '{expected}' but got '{actual}'"
        ))),
        None => Err(HarnessError::Missing(format!("manifest key {key}"))),
    }
}

#[allow(dead_code)]
fn assert_safe_relative_path(path: &Path) -> Result<(), HarnessError> {
    if path.is_absolute() {
        return Err(HarnessError::InvalidInput(format!(
            "absolute path {}",
            path.display()
        )));
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => {
                return Err(HarnessError::InvalidInput(format!(
                    "unsafe path {}",
                    path.display()
                )))
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_loopback_http_url() {
        let parsed = HttpUrl::parse("http://127.0.0.1:8080/app/").expect("url");
        assert_eq!(
            parsed,
            HttpUrl {
                host: "127.0.0.1".to_string(),
                port: 8080,
                path: "/app/".to_string(),
            }
        );
    }

    #[test]
    fn rejects_remote_http_url() {
        assert!(matches!(
            HttpUrl::parse("http://example.com:8080/app/"),
            Err(HarnessError::Http(_))
        ));
    }

    #[test]
    fn parses_manifest_fields() {
        let fields = parse_manifest("a=1\n# skip\nb = two\n");
        assert_eq!(fields.get("a").map(String::as_str), Some("1"));
        assert_eq!(fields.get("b").map(String::as_str), Some("two"));
    }

    #[test]
    fn parses_http_response() {
        let response =
            parse_http_response(b"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<body>")
                .expect("response");
        assert_eq!(response.status, 200);
        assert_eq!(
            response.headers.get("content-type").map(String::as_str),
            Some("text/html")
        );
        assert_eq!(response.body, b"<body>");
    }

    #[test]
    fn rejects_remote_markers() {
        assert!(require_no_remote_markers("x", "fetch('https://example.test')").is_err());
    }

    #[test]
    fn detects_safe_and_unsafe_wasm_exports() {
        let source = r#"
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 { core::ptr::null_mut() }
#[no_mangle]
pub unsafe extern "C" fn load_model(ptr: *const u8, len: usize) -> u32 { 0 }
"#;
        assert!(require_wasm_export(source, "alloc").is_ok());
        assert!(require_wasm_export(source, "load_model").is_ok());
        assert!(require_wasm_export(source, "missing").is_err());
    }
}
