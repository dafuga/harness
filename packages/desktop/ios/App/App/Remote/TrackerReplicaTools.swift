import Foundation
import CoreFoundation

extension TrackerReplicaStore {
    func tool(_ name: String, input: [String: Any], online: Bool, now: Date) -> [String: Any] {
        var reply: [String: Any] = ["source": "local_tracker", "lastSyncedAt": NSNull(),
                                    "freshness": "unavailable", "partial": true]
        do {
            let state = try self.state()
            if let renewal = state.renewedAt, now.timeIntervalSince1970 - renewal >= 7 * 86_400 {
                purge()
                return withError(reply, "denied")
            }
            guard let stamp = state.lastSyncedAt else { return withError(reply, "noReplica") }
            reply["lastSyncedAt"] = stamp
            reply["partial"] = state.partial
            reply["coverage"] = ["items": 2000, "closedDays": 30, "notesPerItem": 10, "runsPerItem": 5]
            let recent = state.caughtUpAt.map { now.timeIntervalSince1970 - $0 < 300 } ?? false
            reply["freshness"] = online && recent ? "current" : "stale"
            reply["data"] = try queryTool(name, input: input, slot: String(state.slot))
        } catch TrackerReplicaError.invalidInput {
            return withError(reply, "invalidInput")
        } catch TrackerReplicaError.noMatch {
            return withError(reply, "noLocalMatch")
        } catch TrackerReplicaError.ambiguous(let ids) {
            reply["data"] = ["candidates": ids]
            return withError(reply, "ambiguousPrefix")
        } catch {
            return withError(reply, "unavailable")
        }
        return reply
    }

    private func queryTool(_ name: String, input: [String: Any], slot: String) throws -> [String: Any] {
        switch name {
        case "tracker_status":
            guard input.isEmpty else { throw TrackerReplicaError.invalidInput }
            return try status(slot: slot)
        case "tracker_show":
            guard input.keys.sorted() == ["id"], let id = input["id"] as? String,
                id.utf8.count >= 6, TrackerReplicaItem.short(id, 80)
            else { throw TrackerReplicaError.invalidInput }
            return try show(id: trackerFold(id), slot: slot)
        case "tracker_document":
            // Not an assistant tool: only the item page reads documents, for "View spec".
            let wanted = try TrackerReplicaAttachment.request(input)
            return try document(id: wanted.id, attachment: wanted.attachment, slot: slot)
        case "tracker_search":
            return try search(input, slot: slot)
        default:
            throw TrackerReplicaError.invalidInput
        }
    }

}

extension TrackerReplicaStore {
    /// "Needs you" is only an open structured ask: 2 to 4 choices with exactly one recommended.
    /// The Mac sends choices only on such asks; other open flags belong to Chief of Staff.
    private static let structuredAsk = """
        json_extract(flags.value, '$.state') = 'open'
        AND json_array_length(flags.value, '$.options') BETWEEN 2 AND 4
        AND (SELECT count(*) FROM json_each(flags.value, '$.options') AS choice
             WHERE json_extract(choice.value, '$.recommended') = 1) = 1
        """

    private func status(slot: String) throws -> [String: Any] {
        let db = try db()
        var counts = Dictionary(uniqueKeysWithValues: TrackerItemHeader.statuses.map { ($0, 0) })
        for row in try db.rows("SELECT status, count(*) FROM items WHERE slot = ? GROUP BY status", [slot]) {
            if let status = row[0], let count = row[1].flatMap(Int.init) { counts[status] = count }
        }
        let flags = try db.rows("""
            SELECT count(*) FROM flags WHERE slot = ? AND \(Self.structuredAsk)
            """, [slot]).first?.first.flatMap { $0 }.flatMap(Int.init)
        let recent = try db.rows("SELECT value FROM items WHERE slot = ? ORDER BY updated DESC, id LIMIT 10", [slot])
        let needing = try db.rows("""
            SELECT items.value,
                (SELECT json_extract(flags.value, '$.question') FROM flags
                 WHERE flags.slot = items.slot AND flags.item = items.id AND \(Self.structuredAsk)),
                (SELECT json_extract(flags.value, '$.at') FROM flags
                 WHERE flags.slot = items.slot AND flags.item = items.id AND \(Self.structuredAsk))
            FROM items
            WHERE items.slot = ? AND EXISTS (
                SELECT 1 FROM flags WHERE flags.slot = items.slot AND flags.item = items.id
                AND \(Self.structuredAsk))
            ORDER BY items.updated DESC, items.id LIMIT 25
            """, [slot])
        let reminders = try db.rows("""
            SELECT value FROM items WHERE slot = ? AND json_extract(value, '$.reminder.at') IS NOT NULL
            ORDER BY json_extract(value, '$.reminder.at'), id LIMIT 100
            """, [slot])
        return ["counts": counts, "unresolvedFlags": flags ?? 0, "recent": try headers(recent),
                "needsYou": try asks(needing), "reminders": try headers(reminders)]
    }

    /// A Needs you entry is the item header plus the question to show on its compact row.
    private func asks(_ rows: [[String?]]) throws -> [Any] {
        try rows.map { row in
            let header = try TrackerReplicaJSON.object(TrackerReplicaJSON.decode(TrackerItemHeader.self, row[0]))
            guard var entry = header as? [String: Any] else { throw TrackerReplicaError.invalidInput }
            if let question = row[1] { entry["question"] = question }
            if let at = row[2] { entry["askedAt"] = at }
            return entry
        }
    }

    private func show(id: String, slot: String) throws -> [String: Any] {
        let db = try db()
        let exact = try db.rows("SELECT id, value FROM items WHERE slot = ? AND id = ?", [slot, id])
        let matches = try exact.isEmpty ? db.rows("""
            SELECT id, value FROM items WHERE slot = ? AND instr(id, ?) = 1 ORDER BY id LIMIT 10
            """, [slot, id]) : exact
        if matches.count > 1 { throw TrackerReplicaError.ambiguous(matches.compactMap { $0[0] }) }
        guard let row = matches.first, let item = row[0] else { throw TrackerReplicaError.noMatch }
        let header = try TrackerReplicaJSON.decode(TrackerItemHeader.self, row[1])
        let notes = try children(TrackerReplicaItem.Note.self, from: "notes", item: [slot, item])
        let flags = try children(TrackerReplicaItem.Flag.self, from: "flags", item: [slot, item])
        let runs = try children(TrackerReplicaItem.Run.self, from: "runs", item: [slot, item])
        let revision = try db.rows("SELECT value FROM attention WHERE slot = ? AND item = ?", [slot, item])
            .first?.first.flatMap { $0 }
        let planning = try children(TrackerReplicaPlanning.self, from: "planning", item: [slot, item])
        // What the assistant reads about an item lists its documents without their text.
        let listed = flags.first.map(TrackerReplicaAttachment.listing)
        return ["item": try TrackerReplicaJSON.object(header), "notes": try TrackerReplicaJSON.object(notes),
                "flag": try listed.map(TrackerReplicaJSON.object) ?? NSNull(),
                "runs": try TrackerReplicaJSON.object(runs),
                "attentionRevision": revision ?? NSNull(),
                "planning": try planning.first.map(TrackerReplicaJSON.object) ?? NSNull()]
    }

    private func document(id: String, attachment: String, slot: String) throws -> [String: Any] {
        let flags = try children(TrackerReplicaItem.Flag.self, from: "flags", item: [slot, id])
        return try TrackerReplicaAttachment.reply(attachment, of: flags.first)
    }

    private func search(_ input: [String: Any], slot: String) throws -> [String: Any] {
        let args = try TrackerSearchArguments(input)
        let rows = try db().rows("""
            SELECT value FROM items WHERE slot = ? AND instr(folded, ?) > 0
                AND (? IS NULL OR project = ?) AND (? IS NULL OR status = ?)
            ORDER BY updated DESC, id LIMIT ?
            """, [slot, args.query, args.project, args.project, args.status, args.status, String(args.limit)])
        return ["items": try headers(rows)]
    }

    private func headers(_ rows: [[String?]]) throws -> Any {
        try TrackerReplicaJSON.object(rows.map { try TrackerReplicaJSON.decode(TrackerItemHeader.self, $0[0]) })
    }

    private func children<T: Decodable>(_ type: T.Type, from table: String, item: [String?]) throws -> [T] {
        return try db().rows("SELECT value FROM \(table) WHERE slot = ? AND item = ? ORDER BY position", item)
            .map { try TrackerReplicaJSON.decode(type, $0[0]) }
    }
}

private struct TrackerSearchArguments {
    let query: String
    let project: String?
    let status: String?
    let limit: Int

    init(_ input: [String: Any]) throws {
        guard Set(input.keys).isSubset(of: ["query", "project", "status", "limit"]),
            let term = input["query"] as? String, (1...160).contains(term.count), !term.utf8.contains(0)
        else { throw TrackerReplicaError.invalidInput }
        query = trackerFold(term)
        project = try Self.text(input["project"], max: 120)
        status = try Self.text(input["status"], max: 20)
        if let status = status, !TrackerItemHeader.statuses.contains(status) { throw TrackerReplicaError.invalidInput }
        limit = try Self.cap(input["limit"])
    }

    private static func text(_ value: Any?, max: Int) throws -> String? {
        guard let value = value else { return nil }
        guard let text = value as? String, TrackerReplicaItem.short(text, max)
        else { throw TrackerReplicaError.invalidInput }
        return text
    }

    private static func cap(_ value: Any?) throws -> Int {
        guard let value = value else { return 10 }
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
            let limit = value as? Int, (1...25).contains(limit)
        else { throw TrackerReplicaError.invalidInput }
        return limit
    }
}

private func withError(_ reply: [String: Any], _ code: String) -> [String: Any] {
    var value = reply
    value["code"] = code
    return value
}
