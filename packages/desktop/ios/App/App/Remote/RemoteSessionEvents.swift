import Foundation

/// What the computer announces by itself (backend-contract.md section 2.5): run progress for the
/// page, and what changes this connection: a new grant, the lock of its screen, sleep, the end
/// of the pairing.
extension RemoteSession {
    /// An event at or below the last sequence was seen before and is dropped, not shown twice.
    func event(_ object: [String: Any]) {
        guard state == "online", let sequence = object["sequence"] as? Int,
            let name = object["channel"] as? String, sequence > (record?.sequence ?? 0)
        else { return }
        record?.sequence = sequence
        let value = object["value"] ?? NSNull()
        if name == "connection", let change = value as? [String: Any], !connection(change) { return }
        onEvent?(["channel": name, "sequence": sequence, "value": value])
    }

    /// False when the event ended the pairing, so that nothing more is handed on.
    private func connection(_ change: [String: Any]) -> Bool {
        switch change["kind"] as? String {
        case "revoked":
            revoke()
            return false
        case "grant": granted(RemoteGrant(change["grant"]))
        case "host": host(change["state"] as? String)
        default: break
        }
        return true
    }

    /// A changed grant is a changed authority: what was kept under the old one leaves, and the
    /// agent methods follow the permission the computer just stated.
    private func granted(_ grant: RemoteGrant?) {
        guard let grant = grant, var record = record else { return }
        let agents: Set<String> = ["createPlan", "approve", "startRun", "cancelRun"]
        let comments: Set<String> = ["addComment", "pendingComments", "openThread"]
        let base = (record.methods ?? []).filter { !agents.contains($0) && (grant.comments != false || !comments.contains($0)) }
        record.grant = grant
        record.methods = grant.agents ? base + agents.sorted() : base
        keep(record)
        onStatus?(snapshot)
    }

    /// A locked computer stays online; only one that goes to sleep is lost.
    private func host(_ state: String?) {
        switch state {
        case "locked", "unlocked":
            locked = state == "locked"
            onStatus?(snapshot)
        case "suspending":
            requests.failChanges(.uncertain)
            move("offline", reason: "The computer is going to sleep.")
        default: break
        }
    }
}
