import Foundation

// Checks of the decision alert contract and its routing. Pure Foundation: no APNs, no UIKit and
// no inbox server. They prove only what this Mac can prove: the parse refuses anything beyond
// the opaque reference, and each alert opens at most one exact review.

private let trackerRef = String(repeating: "1", count: 32)
private let otherTrackerRef = String(repeating: "2", count: 32)
private let deployRef = String(repeating: "d", count: 32)
private let sourceA = String(repeating: "a", count: 64)
private let sourceB = String(repeating: "b", count: 64)

private func payload(_ object: [String: Any]) -> [AnyHashable: Any] {
    ["aps": ["alert": ["title": "Decision needed"]], DecisionAlert.key: object]
}

private func fields(_ category: String, _ reference: String, _ source: String) -> [String: Any] {
    ["category": category, "reference": reference, "source": source]
}

func decisionAlertParseChecks() {
    let tracker = DecisionAlert(userInfo: payload(fields("tracker", trackerRef, sourceA)))
    check(tracker == DecisionAlert(category: .tracker, reference: trackerRef, source: sourceA),
          "a tracker alert with only its reference and source parses")
    let deploy = DecisionAlert(userInfo: payload(fields("deploy", deployRef, sourceA)))
    check(deploy?.category == .deploy, "a deploy alert parses into its own category")
    check(DecisionAlert(userInfo: ["aps": ["alert": "text"]]) == nil, "an alert without the decision object is refused")
    let refused: [[String: Any]] = [
        ["category": "approve", "reference": trackerRef, "source": sourceA],
        ["category": "vault", "reference": trackerRef, "source": sourceA],
        ["category": "tracker", "reference": String(repeating: "1", count: 31), "source": sourceA],
        ["category": "tracker", "reference": String(repeating: "1", count: 33), "source": sourceA],
        ["category": "tracker", "reference": String(repeating: "A", count: 32), "source": sourceA],
        ["category": "tracker", "reference": String(repeating: "g", count: 32), "source": sourceA],
        ["category": "tracker", "reference": trackerRef, "source": String(repeating: "a", count: 63)],
        ["category": "tracker", "reference": trackerRef, "source": String(repeating: "A", count: 64)],
        ["category": "tracker", "reference": 1, "source": sourceA],
        ["category": "tracker", "reference": trackerRef],
        ["category": "tracker", "reference": trackerRef, "source": sourceA, "reason": "Deploy prod"],
        ["category": "tracker", "reference": trackerRef, "source": sourceA, "item": "secret-item"],
        ["category": "tracker", "reference": trackerRef, "source": sourceA, "token": "x"]
    ]
    let parsed = refused.map { DecisionAlert(userInfo: payload($0)) }
    check(parsed.allSatisfy { $0 == nil }, "an unknown category, a bad reference or source, or any extra field is refused")
    check(DecisionAlert(userInfo: [DecisionAlert.key: "tracker"]) == nil, "a decision object that is not a dictionary is refused")
}

private func tracker(_ reference: String, _ source: String, _ state: DecisionEntry.State = .pending) -> DecisionEntry {
    DecisionEntry(category: .tracker, reference: reference, source: source, state: state)
}

private func deploy(_ reference: String, _ source: String, _ state: DecisionEntry.State = .pending) -> DecisionEntry {
    DecisionEntry(category: .deploy, reference: reference, source: source, state: state)
}

private func trackerAlert(_ reference: String, _ source: String) -> DecisionAlert {
    DecisionAlert(category: .tracker, reference: reference, source: source)
}

private func deployAlert(_ reference: String, _ source: String) -> DecisionAlert {
    DecisionAlert(category: .deploy, reference: reference, source: source)
}

func decisionRoutingChecks() {
    let target = DecisionTarget(category: .tracker, reference: trackerRef, source: sourceA)
    var router = DecisionRouter(entries: [tracker(trackerRef, sourceA), deploy(deployRef, sourceA)])
    check(router.route(trackerAlert(trackerRef, sourceA)) == .review(target),
          "a pending tracker alert opens its exact review")
    check(router.route(trackerAlert(trackerRef, sourceA)) == .duplicate(target),
          "a redelivered tracker alert opens the same item and is not routed twice")
    check(router.route(deployAlert(deployRef, sourceA)) == .review(DecisionTarget(category: .deploy, reference: deployRef, source: sourceA)),
          "a deploy alert opens its own release review, separate from the tracker inbox")
    check(router.route(deployAlert(trackerRef, sourceA)) == .mismatch,
          "a deploy alert naming a tracker reference is refused, not opened")
    check(router.route(trackerAlert(deployRef, sourceA)) == .mismatch,
          "a tracker alert naming a deploy reference is refused, not opened")
    check(router.route(trackerAlert(otherTrackerRef, sourceA)) == .unknown,
          "a reference missing from the fresh inbox is unknown and needs a refresh")
    check(router.route(trackerAlert(trackerRef, sourceB)) == .unknown,
          "the same reference from another source never opens this source's item")
}

func decisionFreshnessChecks() {
    var router = DecisionRouter(entries: [tracker(trackerRef, sourceA), deploy(deployRef, sourceA)])
    _ = router.route(trackerAlert(trackerRef, sourceA))
    router.refresh(entries: [tracker(trackerRef, sourceA, .decided), deploy(deployRef, sourceA)], revokedSources: [])
    check(router.route(trackerAlert(trackerRef, sourceA)) == .stale(DecisionTarget(category: .tracker, reference: trackerRef, source: sourceA)),
          "a redelivered alert after the request was decided is stale, not a live review")
    router.refresh(entries: [tracker(trackerRef, sourceA), deploy(deployRef, sourceA, .expired)], revokedSources: [])
    check(router.route(deployAlert(deployRef, sourceA)) == .stale(DecisionTarget(category: .deploy, reference: deployRef, source: sourceA)),
          "an expired release decision is stale and never opens for approval")
    check(router.route(trackerAlert(trackerRef, sourceA)) == .duplicate(DecisionTarget(category: .tracker, reference: trackerRef, source: sourceA)),
          "a refresh keeps which alerts were routed, so a redelivery is still a duplicate")

    var fresh = DecisionRouter(entries: [tracker(trackerRef, sourceA)], revokedSources: [sourceA])
    check(fresh.route(trackerAlert(trackerRef, sourceA)) == .revoked,
          "an alert from a revoked source is refused even while its request is pending")
    fresh.refresh(entries: [tracker(trackerRef, sourceA)], revokedSources: [])
    check(fresh.route(trackerAlert(trackerRef, sourceA)) == .review(DecisionTarget(category: .tracker, reference: trackerRef, source: sourceA)),
          "the same alert opens once the source is routed again on a fresh inbox")
    fresh.refresh(entries: [tracker(trackerRef, sourceA)], revokedSources: [sourceA])
    check(fresh.route(deployAlert(trackerRef, sourceA)) == .revoked,
          "revocation is checked before category, so a mismatched alert from a revoked source reveals nothing")
}

func decisionAlertChecks() {
    decisionAlertParseChecks()
    decisionRoutingChecks()
    decisionFreshnessChecks()
}
