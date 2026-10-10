//! The vectors shared with the TypeScript reference and every runtime adapter.

use serde_json::Value;

#[test]
fn every_shared_vector_matches() {
    let vectors: Vec<Value> = serde_json::from_str(include_str!("vectors.json")).unwrap();
    assert!(vectors.len() >= 25);
    for vector in &vectors {
        let text = match vector.get("text").and_then(Value::as_str) {
            Some(text) => text.to_owned(),
            None => vector["request"].to_string(),
        };
        let actual: Value = serde_json::from_str(&impact_kernel::handle(&text)).unwrap();
        assert_eq!(actual, vector["response"], "{}", vector["name"]);
    }
}

#[test]
fn invalid_utf8_and_empty_input_are_refused_as_invalid_json() {
    let empty: Value = serde_json::from_str(&impact_kernel::handle("")).unwrap();
    assert_eq!(empty["error"]["code"], "invalid-json");
}
