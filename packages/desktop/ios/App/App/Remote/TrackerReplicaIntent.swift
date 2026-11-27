import Foundation

struct TrackerReplicaIntent: Codable {
    let version: Int
    let intentId: String
    let itemId: String
    let action: String
    let text: String
    let revision: String?
    /// The item status the phone showed. Only lifecycle actions carry it; older payloads decode as nil.
    let expectedStatus: String?
    /// The tapped option's 1-based number for an answer; absent for free text and older payloads.
    var option: Int? = nil
    var confirmed: Bool? = nil
}

struct TrackerReplicaActionRule {
    let textRequired: Bool
    let expectsStatus: Bool
    let needsOpenFlag: Bool
}

/// Mirrors the server allowlist in phoneReplicaActions.ts. Anything else is refused before queueing.
enum TrackerReplicaActions {
    static let rules: [String: TrackerReplicaActionRule] = [
        "note": TrackerReplicaActionRule(textRequired: true, expectsStatus: false, needsOpenFlag: false),
        "flag": TrackerReplicaActionRule(textRequired: true, expectsStatus: false, needsOpenFlag: false),
        "answer": TrackerReplicaActionRule(textRequired: true, expectsStatus: false, needsOpenFlag: true),
        "start": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: false),
        "reopen": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: false),
        "block": TrackerReplicaActionRule(textRequired: true, expectsStatus: true, needsOpenFlag: false),
        "unblock": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: false),
        "resolve": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: true),
        "done": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: false),
        "ignore": TrackerReplicaActionRule(textRequired: true, expectsStatus: true, needsOpenFlag: false),
        "unignore": TrackerReplicaActionRule(textRequired: false, expectsStatus: true, needsOpenFlag: false),
        "remind": TrackerReplicaActionRule(textRequired: true, expectsStatus: true, needsOpenFlag: false),
    ]
}

struct TrackerReplicaConfirmation {
    let scope: String
    let itemTitle: String
    let question: String?
    let intent: TrackerReplicaIntent
    let discard: Bool
    /// The ask's confirm kind when an option answer needs the device owner's check.
    var confirm: String? = nil
}

enum TrackerReplicaWriteError: String, Error {
    case denied, noReplica, noLocalMatch, invalidInput, noFlag, staleReview, queueFull, unavailable
}
