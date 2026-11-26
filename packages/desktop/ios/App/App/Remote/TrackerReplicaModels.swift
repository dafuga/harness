import Foundation

enum TrackerReplicaError: Error {
    case invalidPage
    case database
    case unsupportedSchema
    case invalidInput
    case noMatch
    case ambiguous([String])
}

struct TrackerItemHeader: Codable {
    let id: String
    let title: String
    let project: String
    let status: String
    let updatedAt: String?
    let dueAt: String?

    let stage: String?
    /// Set on an active personal item. Older Macs send none.
    var reminder: TrackerReplicaReminder? = nil

    static let statuses = ["open", "in_progress", "blocked", "done", "ignored"]
}

struct TrackerReplicaReminder: Codable {
    let at: String
    let repeats: String?

    var valid: Bool { TrackerReplicaItem.short(at, 40) && TrackerReplicaItem.short(repeats ?? "", 20) }
}

/// Only these fields are retained from an authenticated JSON reply.
struct TrackerReplicaItem: Codable {
    struct Note: Codable {
        let id: String
        let author: String
        let at: String
        let text: String
    }

    struct Flag: Codable {
        /// One tappable answer. The server sends at most four, recommended or not.
        struct Option: Codable {
            let label: String
            let effect: String
            let recommended: Bool?
        }

        let state: String
        let at: String?
        let question: String
        var options: [Option]? = nil
        /// deploy, money or secret: the answer needs the device owner's Face ID or passcode.
        var confirm: String? = nil
        /// Specs and documents behind "View spec". Older Macs send none.
        var attachments: [TrackerReplicaAttachment]? = nil
    }

    struct Run: Codable {
        let id: String
        let origin: String
        let state: String
        let outcome: String?
        let queuedAt: Double?
        let startedAt: Double?
        let endedAt: Double?
    }

    let id: String
    let title: String
    let project: String
    let status: String
    let updatedAt: String?
    let dueAt: String?
    let notes: [Note]
    let flag: Flag?
    let runs: [Run]
    let attentionRevision: String?
    let stage: String?
    let planning: TrackerReplicaPlanning?
    let reminder: TrackerReplicaReminder?

    var header: TrackerItemHeader {
        TrackerItemHeader(id: id, title: title, project: project, status: status, updatedAt: updatedAt, dueAt: dueAt, stage: stage, reminder: reminder)
    }

    var valid: Bool {
        Self.short(id, 80) && Self.short(title, 240) && Self.short(project, 120)
            && TrackerItemHeader.statuses.contains(status)
            && Self.short(updatedAt ?? "", 40) && Self.short(dueAt ?? "", 40) && (reminder.map(\.valid) ?? true)
            && (stage.map { ["idea", "detail", "design", "build"].contains($0) } ?? true)
            && notes.count <= 10 && notes.allSatisfy(Self.validNote)
            && (flag.map(Self.validFlag) ?? true)
            && runs.count <= 5 && runs.allSatisfy(Self.validRun)
            && (attentionRevision.map { $0.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil } ?? true)
    }

    private static func validNote(_ note: Note) -> Bool {
        short(note.id, 80) && short(note.author, 80) && short(note.at, 40) && short(note.text, 512)
    }

    private static func validFlag(_ flag: Flag) -> Bool {
        ["open", "resolved"].contains(flag.state) && short(flag.at ?? "", 40) && short(flag.question, 512)
            && (flag.attachments.map { $0.count <= 4 && $0.allSatisfy(\.valid) } ?? true)
            && (flag.options.map { $0.count <= 4 && $0.allSatisfy { short($0.label, 80) && short($0.effect, 400) } } ?? true)
            && (flag.confirm.map { ["deploy", "money", "secret"].contains($0) } ?? true)
    }

    private static func validRun(_ run: Run) -> Bool {
        short(run.id, 32) && short(run.origin, 80)
            && ["queued", "running", "verifying", "observed", "finished"].contains(run.state)
            && [nil, "done", "failed", "rejected", "blocked", "timed_out", "abandoned"].contains(run.outcome)
    }

    static func short(_ value: String, _ max: Int) -> Bool {
        value.utf8.count <= max && !value.utf8.contains(0)
    }
}

struct TrackerReplicaPage: Decodable {
    struct Operation: Decodable {
        let id: String
        let row: TrackerReplicaItem?

        enum CodingKeys: CodingKey { case id, row }

        init(from decoder: Decoder) throws {
            let fields = try decoder.container(keyedBy: CodingKeys.self)
            id = try fields.decode(String.self, forKey: .id)
            guard fields.contains(.row) else { throw TrackerReplicaError.invalidPage }
            row = try fields.decodeIfPresent(TrackerReplicaItem.self, forKey: .row)
        }

        var valid: Bool {
            !id.isEmpty && TrackerReplicaItem.short(id, 80) && (row.map { $0.id == id && $0.valid } ?? true)
        }
    }

    let kind: String
    let snapshotId: String?
    let requestCursor: String?
    let requestContinuation: String?
    let cursor: String?
    let continuation: String?
    let rows: [TrackerReplicaItem]?
    let operations: [Operation]?
    let hasMore: Bool?
    let hubTime: String?
    let partial: Bool?
    let code: String?

    static func decode(_ value: Any) throws -> TrackerReplicaPage {
        guard JSONSerialization.isValidJSONObject(value) else { throw TrackerReplicaError.invalidPage }
        let bytes = try JSONSerialization.data(withJSONObject: value, options: [.withoutEscapingSlashes])
        guard bytes.count <= 128 * 1024 else { throw TrackerReplicaError.invalidPage }
        let page = try JSONDecoder().decode(Self.self, from: bytes)
        guard page.positionFieldsFit else { throw TrackerReplicaError.invalidPage }
        return page
    }

    private var positionFieldsFit: Bool {
        let tokens = [cursor, requestCursor, continuation, requestContinuation, snapshotId].compactMap { $0 }
        return tokens.allSatisfy { !$0.isEmpty && TrackerReplicaItem.short($0, 512) }
    }

    var validSnapshot: Bool {
        guard snapshotId != nil, let rows = rows, rows.count <= 100, (cursor == nil) != (continuation == nil)
        else { return false }
        return rows.allSatisfy { !$0.id.isEmpty && $0.valid } && Set(rows.map(\.id)).count == rows.count
    }

    var validDelta: Bool {
        guard let operations = operations, operations.count <= 100, let cursor = cursor,
            let request = requestCursor, let more = hasMore
        else { return false }
        guard cursor != request || (operations.isEmpty && !more) else { return false }
        return operations.allSatisfy(\.valid)
    }
}

struct TrackerReplicaState: Codable {
    var slot = 0
    var cursor: String?
    var continuation: String?
    var snapshotId: String?
    var lastSyncedAt: String?
    var caughtUpAt: Double?
    var renewedAt: Double?
    var partial = true

    var input: [String: Any] {
        if let continuation = continuation { return ["version": 1, "continuation": continuation] }
        if let cursor = cursor { return ["version": 1, "cursor": cursor] }
        return ["version": 1]
    }

    var staging: Int { 1 - slot }
}

enum TrackerReplicaJSON {
    static func string<T: Encodable>(_ value: T) throws -> String {
        let data = try JSONEncoder().encode(value)
        guard let text = String(data: data, encoding: .utf8) else { throw TrackerReplicaError.database }
        return text
    }

    static func decode<T: Decodable>(_ type: T.Type, _ text: String?) throws -> T {
        guard let text = text else { throw TrackerReplicaError.database }
        return try JSONDecoder().decode(type, from: Data(text.utf8))
    }

    static func object<T: Encodable>(_ value: T) throws -> Any {
        return try JSONSerialization.jsonObject(with: JSONEncoder().encode(value), options: .fragmentsAllowed)
    }
}
