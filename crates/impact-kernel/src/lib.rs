//! Reverse transitive impact over base and head dependency graphs.
//!
//! One JSON request in, one JSON response envelope out. The TypeScript reference in
//! `src/utils/impactKernel.ts` defines the behaviour; this crate must match it exactly.

pub mod abi;
mod impact;
mod request;

use serde_json::Value;

pub const CONTRACT: &str = "impact-kernel/1";

/// Handles one request and always returns one response envelope.
///
/// Text that is not portable JSON is refused as `invalid-json`: malformed syntax, a number no
/// double can hold, a lone surrogate escape, or nesting deeper than 64 levels.
pub fn handle(text: &str) -> String {
    if let Some(parsed) = request::parse_typed(text) {
        return answer(parsed);
    }
    match serde_json::from_str::<Value>(text) {
        Ok(request) if request::portable(&request, 0) => respond(&request),
        _ => failure("invalid-json", "request is not valid JSON"),
    }
}

fn respond(request: &Value) -> String {
    let Some(operation) = request.get("operation").and_then(Value::as_str) else {
        return failure(
            "invalid-request",
            "request must be an object with an operation",
        );
    };
    match operation {
        "version" => success(&format!("{{\"contract\":\"{CONTRACT}\"}}")),
        "impact" => answer(request::parse(request.get("input"))),
        other => failure(
            "unknown-operation",
            &format!("operation \"{other}\" is not supported"),
        ),
    }
}

fn answer(parsed: Result<request::Input, request::Failure>) -> String {
    match parsed {
        Ok(input) => success(&impact::compute(&input)),
        Err(error) => failure(error.code, &error.message),
    }
}

fn success(output: &str) -> String {
    format!("{{\"ok\":true,\"output\":{output}}}")
}

fn failure(code: &str, message: &str) -> String {
    let message = Value::from(message);
    format!("{{\"ok\":false,\"error\":{{\"code\":\"{code}\",\"message\":{message}}}}}")
}
