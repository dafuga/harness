//! Breadth-first reverse closure over both graphs, merged into one answer.

use std::collections::{HashMap, HashSet};
use std::fmt::Write;

use serde_json::Value;

use crate::request::{Graph, Input};

struct Reached<'a> {
    ids: &'a [String],
    index: HashMap<&'a str, usize>,
    /// Hops from the nearest seed, or -1.
    distance: Vec<i32>,
    /// Non-negative for nodes some sink depends on.
    covered: Vec<i32>,
}

/// Returns the impact output as JSON text.
pub fn compute(input: &Input) -> String {
    let triggered = !input.changed.is_empty();
    let seeds: Vec<&str> = input
        .changed
        .iter()
        .chain(input.uncertain.iter().filter(|_| triggered))
        .map(String::as_str)
        .collect();
    let base = reach(&input.base, &seeds, &input.sinks);
    let head = reach(&input.head, &seeds, &input.sinks);
    let changed: HashSet<&str> = input.changed.iter().map(String::as_str).collect();
    let base_only = base
        .ids
        .iter()
        .filter(|id| !head.index.contains_key(id.as_str()));
    let mut affected = Vec::new();
    for id in head.ids.iter().chain(base_only) {
        if let Some(node) = merge(id, &base, &head, &changed) {
            affected.push(node);
        }
    }
    let (uncovered, unknown) = coverage(&input.changed, &base, &head);
    format!(
        "{{\"affected\":[{}],\"uncovered\":{},\"unknown\":{}}}",
        affected.join(","),
        Value::from(uncovered),
        Value::from(unknown)
    )
}

fn merge(id: &str, base: &Reached, head: &Reached, changed: &HashSet<&str>) -> Option<String> {
    let in_base = base.index.get(id).copied();
    let in_head = head.index.get(id).copied();
    let from_base = in_base.map_or(-1, |position| base.distance[position]);
    let from_head = in_head.map_or(-1, |position| head.distance[position]);
    let (distance, via) = match (from_base >= 0, from_head >= 0) {
        (true, true) => (from_base.min(from_head), "both"),
        (true, false) => (from_base, "base"),
        (false, true) => (from_head, "head"),
        (false, false) => return None,
    };
    let presence = match (in_base, in_head) {
        (Some(_), Some(_)) => "both",
        (None, _) => "added",
        _ => "removed",
    };
    let seed = match (changed.contains(id), distance) {
        (true, _) => "\"changed\"",
        (false, 0) => "\"uncertain\"",
        _ => "null",
    };
    let mut node = format!("{{\"id\":{},", Value::from(id));
    let _ = write!(node, "\"distance\":{distance},\"via\":\"{via}\",");
    let _ = write!(node, "\"presence\":\"{presence}\",\"seed\":{seed}}}");
    Some(node)
}

/// Splits the changed ids into those no sink depends on and those in neither graph.
///
/// Coverage is judged in the head graph for an id that still exists there, and in the base
/// graph only for a removed id: a surviving change needs a test or scenario in head.
fn coverage(changed: &[String], base: &Reached, head: &Reached) -> (Vec<String>, Vec<String>) {
    let mut seen = HashSet::new();
    let mut uncovered = Vec::new();
    let mut unknown = Vec::new();
    for id in changed.iter().filter(|id| seen.insert(id.as_str())) {
        let in_head = head.index.get(id.as_str()).map(|at| head.covered[*at] >= 0);
        let in_base = base.index.get(id.as_str()).map(|at| base.covered[*at] >= 0);
        match in_head.or(in_base) {
            Some(true) => {}
            Some(false) => uncovered.push(id.clone()),
            None => unknown.push(id.clone()),
        }
    }
    (uncovered, unknown)
}

fn reach<'a>(graph: &'a Graph, seeds: &[&str], sinks: &[String]) -> Reached<'a> {
    let size = graph.nodes.len();
    let mut dependents = vec![Vec::new(); size];
    let mut dependencies = vec![Vec::new(); size];
    for &(from, to) in &graph.edges {
        dependents[to].push(from);
        dependencies[from].push(to);
    }
    let positions = graph.nodes.iter().enumerate();
    let index: HashMap<&str, usize> = positions.map(|(at, id)| (id.as_str(), at)).collect();
    let sinks: Vec<&str> = sinks.iter().map(String::as_str).collect();
    Reached {
        ids: &graph.nodes,
        distance: breadth_first(&index, seeds, &dependents),
        covered: breadth_first(&index, &sinks, &dependencies),
        index,
    }
}

fn breadth_first(index: &HashMap<&str, usize>, starts: &[&str], next: &[Vec<usize>]) -> Vec<i32> {
    let mut distance = vec![-1; next.len()];
    let mut queue = Vec::new();
    for position in starts.iter().filter_map(|id| index.get(id).copied()) {
        if distance[position] != 0 {
            distance[position] = 0;
            queue.push(position);
        }
    }
    let mut cursor = 0;
    while cursor < queue.len() {
        let current = queue[cursor];
        cursor += 1;
        for &neighbor in &next[current] {
            if distance[neighbor] == -1 {
                distance[neighbor] = distance[current] + 1;
                queue.push(neighbor);
            }
        }
    }
    distance
}
