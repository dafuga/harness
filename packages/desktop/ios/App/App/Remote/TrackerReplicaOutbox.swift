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
    ]
}

struct TrackerReplicaConfirmation {
    let scope: String
    let itemTitle: String
    let question: String?
    let intent: TrackerReplicaIntent
    let discard: Bool
}

enum TrackerReplicaWriteError: String, Error {
    case denied, noReplica, noLocalMatch, invalidInput, noFlag, staleReview, queueFull, unavailable
}

extension TrackerReplicaStore {
    /// The user is shown the stored item and, for an answer or resolve, the exact flag being acted on.
    /// Lifecycle actions take the status shown here as the expected status, as the server checks it.
    func prepareWrite(scope: String, action: String, input: [String: Any]) throws -> TrackerReplicaConfirmation {
        let needsReview = action == "flag" || action == "answer"
        guard let rule = TrackerReplicaActions.rules[action],
            input.keys.allSatisfy({ $0 == "id" || $0 == "text" || (needsReview && $0 == "revision") }),
            let id = input["id"] as? String, id.utf8.count >= 6, TrackerReplicaItem.short(id, 80),
            let text = input["text"] as? String, TrackerReplicaItem.short(text, 512),
            !rule.textRequired || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, safeDraft(text)
        else { throw TrackerReplicaWriteError.invalidInput }
        let state = try writableState()
        let item = try itemForWrite(id.lowercased(), slot: state.slot)
        if rule.needsOpenFlag, item.flag?.state != "open" { throw TrackerReplicaWriteError.noFlag }
        if action != "note", item.revision == nil { throw TrackerReplicaWriteError.noReplica }
        if needsReview, (input["revision"] as? String) != item.revision {
            throw TrackerReplicaWriteError.staleReview
        }
        let intent = TrackerReplicaIntent(
            version: 1, intentId: UUID().uuidString.lowercased(), itemId: item.header.id,
            action: action, text: text, revision: action == "note" ? nil : item.revision,
            expectedStatus: rule.expectsStatus ? item.header.status : nil
        )
        return TrackerReplicaConfirmation(
            scope: scope, itemTitle: item.header.title,
            question: rule.needsOpenFlag ? item.flag?.question : nil, intent: intent, discard: false
        )
    }

    func prepareDiscard(scope: String, input: [String: Any]) throws -> TrackerReplicaConfirmation {
        guard input.keys.sorted() == ["intentId"], let intentId = input["intentId"] as? String,
            UUID(uuidString: intentId) != nil
        else { throw TrackerReplicaWriteError.invalidInput }
        let state = try writableState()
        let storage = try outbox()
        let payload = try storage.rows(
            "SELECT payload FROM outbox WHERE intent = ? AND conflict IS NOT NULL AND conflict IS NOT 'accepted'", [intentId]
        ).first?.first.flatMap { $0 }
        guard let payload = payload else { throw TrackerReplicaWriteError.noLocalMatch }
        let intent = try TrackerReplicaJSON.decode(TrackerReplicaIntent.self, payload)
        let title = (try? itemForWrite(intent.itemId, slot: state.slot))?.header.title ?? intent.itemId
        return TrackerReplicaConfirmation(scope: scope, itemTitle: title, question: nil, intent: intent, discard: true)
    }

    func discardConflict(_ intent: TrackerReplicaIntent) throws {
        _ = try writableState()
        try outbox().run(
            "DELETE FROM outbox WHERE intent = ? AND conflict IS NOT NULL AND conflict IS NOT 'accepted'",
            [intent.intentId]
        )
    }

    func enqueueWrite(_ intent: TrackerReplicaIntent) throws {
        _ = try writableState()
        let storage = try outbox()
        try storage.transaction {
            let count = try storage.rows("SELECT count(*) FROM outbox WHERE conflict IS NOT 'accepted'")
                .first?.first.flatMap { $0 }.flatMap(Int.init)
            guard let count = count, count < 100 else { throw TrackerReplicaWriteError.queueFull }
            try storage.run(
                "INSERT INTO outbox(intent, item, payload) VALUES (?, ?, ?)",
                [intent.intentId, intent.itemId, try TrackerReplicaJSON.string(intent)]
            )
        }
    }

    func nextWrite() throws -> TrackerReplicaIntent? {
        _ = try writableState()
        let row = try outbox().rows("""
            SELECT pending.payload FROM outbox pending
            WHERE pending.conflict IS NULL AND NOT EXISTS (
                SELECT 1 FROM outbox earlier
                WHERE earlier.item = pending.item AND earlier.sequence < pending.sequence
                    AND earlier.conflict IS NOT 'accepted'
            )
            ORDER BY pending.sequence LIMIT 1
            """).first
        guard let row = row else { return nil }
        return try TrackerReplicaJSON.decode(TrackerReplicaIntent.self, row.first.flatMap { $0 })
    }

    /// A conflict blocks this item's later writes. The other items can still drain. An accepted
    /// write stays visible as acknowledged; it no longer blocks anything.
    func finishWrite(_ intent: TrackerReplicaIntent, conflict: String?) throws {
        let storage = try outbox()
        try storage.transaction {
            try storage.run("UPDATE outbox SET conflict = ? WHERE intent = ?", [conflict ?? "accepted", intent.intentId])
            guard conflict == nil else { return }
            try storage.run("""
                DELETE FROM outbox WHERE sequence IN (
                    SELECT sequence FROM outbox WHERE conflict = 'accepted' ORDER BY sequence DESC LIMIT -1 OFFSET 20)
                """)
        }
    }

}

extension TrackerReplicaStore {
    func writeStatus() throws -> [[String: String]] {
        _ = try writableState()
        return try outbox().rows("SELECT intent, item, conflict FROM outbox ORDER BY sequence").map { row in
            let conflict = row[2]
            let reason = conflict == nil || conflict == "accepted" ? "" : conflict ?? ""
            return ["intentId": row[0] ?? "", "itemId": row[1] ?? "", "status": outboxStatus(conflict), "reason": reason]
        }
    }

    private func outboxStatus(_ conflict: String?) -> String {
        switch conflict {
        case nil: return "queued"
        case "accepted": return "accepted"
        default: return "conflict"
        }
    }

    func purgeWrites() throws {
        try db().run("DROP TABLE IF EXISTS outbox")
    }

    private func writableState() throws -> TrackerReplicaState {
        let state = try self.state()
        guard let renewed = state.renewedAt, state.lastSyncedAt != nil else { throw TrackerReplicaWriteError.noReplica }
        if now().timeIntervalSince1970 - renewed >= 7 * 86_400 {
            purge()
            throw TrackerReplicaWriteError.denied
        }
        return state
    }

    private func outbox() throws -> TrackerReplicaSQLite {
        let storage = try db()
        try storage.run("""
            CREATE TABLE IF NOT EXISTS outbox (
                sequence INTEGER PRIMARY KEY, intent TEXT UNIQUE NOT NULL,
                item TEXT NOT NULL, payload TEXT NOT NULL, conflict TEXT
            )
            """)
        return storage
    }

    private func itemForWrite(_ id: String, slot: Int) throws
        -> (header: TrackerItemHeader, flag: TrackerReplicaItem.Flag?, revision: String?)
    {
        let storage = try db()
        let exact = try storage.rows("SELECT value FROM items WHERE slot = ? AND id = ?", [String(slot), id])
        let matches = exact.isEmpty
            ? try storage.rows(
                "SELECT value FROM items WHERE slot = ? AND substr(id, 1, length(?)) = ? LIMIT 2",
                [String(slot), id, id]
            )
            : exact
        guard matches.count == 1 else { throw TrackerReplicaWriteError.noLocalMatch }
        let header = try TrackerReplicaJSON.decode(TrackerItemHeader.self, matches[0][0])
        let filter = [String(slot), header.id]
        let flagValue = try storage.rows("SELECT value FROM flags WHERE slot = ? AND item = ?", filter)
            .first?.first.flatMap { $0 }
        let flag = try flagValue.map { try TrackerReplicaJSON.decode(TrackerReplicaItem.Flag.self, $0) }
        let revision = try storage.rows("SELECT value FROM attention WHERE slot = ? AND item = ?", filter)
            .first?.first.flatMap { $0 }
        return (header, flag, revision)
    }

    private func safeDraft(_ text: String) -> Bool {
        let secrets = #"(?i)PRIVATE KEY-----|\b(?:bearer|basic)\s+[\w+/=.-]{8,}|\b(?:github_pat_|gh[pousr]_|sk-|xox[abprs]-)[\w-]{10,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[\w-]+\.[\w-]+|(?:password|passwd|secret|token|api[_-]?key|authorization)\s*[=:]|://[^\s/@]+@|[?&](?:code|sig|signature|key|auth|session)="#
        let locations = #"(?i)\bfile://|(?:^|[\s"'])(?:/(?:Users|home|root|private|tmp|Volumes)/|[a-z]:[\\/])|\b(?:https?|wss?)://(?:localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])"#
        return [secrets, locations].allSatisfy { text.range(of: $0, options: .regularExpression) == nil }
    }
}
