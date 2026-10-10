//! Request validation in the fixed order shared with the TypeScript reference.

use std::collections::HashSet;

use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Graph {
    pub nodes: Vec<String>,
    pub edges: Vec<(usize, usize)>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub base: Graph,
    pub head: Graph,
    pub changed: Vec<String>,
    pub uncertain: Vec<String>,
    pub sinks: Vec<String>,
}

pub struct Failure {
    pub code: &'static str,
    pub message: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Typed {
    operation: String,
    input: Input,
}

/// Fast path for well-formed impact requests. It accepts only the exact fields of the contract,
/// so nothing is skipped unchecked; every other request, including each malformed one, is left
/// to the general path, which reports errors like the reference does.
pub fn parse_typed(text: &str) -> Option<Result<Input, Failure>> {
    let request: Typed = serde_json::from_str(text).ok()?;
    if request.operation != "impact" {
        return None;
    }
    let checked = check(&request.input.base, "base").and(check(&request.input.head, "head"));
    Some(checked.map(|()| request.input))
}

/// Deepest nesting of arrays and objects a portable request may have.
const MAX_DEPTH: usize = 64;

/// Whether the document stays within the nesting every implementation accepts. Numbers and
/// strings need no check here: the parser already refuses values a double or UTF-8 cannot hold.
pub fn portable(value: &Value, level: usize) -> bool {
    match value {
        Value::Array(items) => {
            level < MAX_DEPTH && items.iter().all(|item| portable(item, level + 1))
        }
        Value::Object(fields) => {
            level < MAX_DEPTH && fields.values().all(|item| portable(item, level + 1))
        }
        _ => true,
    }
}

pub fn parse(input: Option<&Value>) -> Result<Input, Failure> {
    let fields = input.and_then(Value::as_object).ok_or(Failure {
        code: "invalid-request",
        message: "impact input must be an object".to_owned(),
    })?;
    let base = graph(fields.get("base"), "base")?;
    let head = graph(fields.get("head"), "head")?;
    let changed = list(fields, "changed")?;
    let uncertain = list(fields, "uncertain")?;
    let sinks = list(fields, "sinks")?;
    check(&base, "base")?;
    check(&head, "head")?;
    Ok(Input {
        base,
        head,
        changed,
        uncertain,
        sinks,
    })
}

fn malformed(field: &str) -> Failure {
    Failure {
        code: "invalid-request",
        message: format!("impact input field \"{field}\" is malformed"),
    }
}

fn list(fields: &Map<String, Value>, field: &str) -> Result<Vec<String>, Failure> {
    strings(fields.get(field)).ok_or_else(|| malformed(field))
}

fn graph(value: Option<&Value>, name: &str) -> Result<Graph, Failure> {
    let fields = value.and_then(Value::as_object);
    let nodes = strings(fields.and_then(|map| map.get("nodes")));
    let nodes = nodes.ok_or_else(|| malformed(&format!("{name}.nodes")))?;
    let edges = pairs(fields.and_then(|map| map.get("edges")));
    let edges = edges.ok_or_else(|| malformed(&format!("{name}.edges")))?;
    Ok(Graph { nodes, edges })
}

fn strings(value: Option<&Value>) -> Option<Vec<String>> {
    let items = value?.as_array()?;
    items
        .iter()
        .map(|item| item.as_str().map(str::to_owned))
        .collect()
}

fn pairs(value: Option<&Value>) -> Option<Vec<(usize, usize)>> {
    value?.as_array()?.iter().map(pair).collect()
}

fn pair(value: &Value) -> Option<(usize, usize)> {
    match value.as_array()?.as_slice() {
        [from, to] => Some((index(from)?, index(to)?)),
        _ => None,
    }
}

/// Accepts any non-negative integral JSON number, as `Number.isInteger` does in the reference.
fn index(value: &Value) -> Option<usize> {
    if let Some(whole) = value.as_u64() {
        return Some(usize::try_from(whole).unwrap_or(usize::MAX));
    }
    let float = value.as_f64()?;
    let integral = float >= 0.0 && float.fract() == 0.0;
    integral.then_some(float as usize)
}

fn check(graph: &Graph, name: &str) -> Result<(), Failure> {
    let mut seen = HashSet::with_capacity(graph.nodes.len());
    for id in &graph.nodes {
        if !seen.insert(id.as_str()) {
            return Err(invalid(format!("{name} graph repeats node \"{id}\"")));
        }
    }
    let size = graph.nodes.len();
    let outside = |edge: &(usize, usize)| edge.0 >= size || edge.1 >= size;
    match graph.edges.iter().position(outside) {
        Some(edge) => Err(invalid(format!("{name} graph edge {edge} is out of range"))),
        None => Ok(()),
    }
}

fn invalid(message: String) -> Failure {
    Failure {
        code: "invalid-graph",
        message,
    }
}
