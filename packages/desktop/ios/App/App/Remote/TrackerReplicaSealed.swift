import Foundation

/// Account replica storage uses the same platform SQLite and protections as the paired replica.
/// A separate root keeps the two authorities and their lifecycle independent.
final class TrackerReplicaSealed {
    private let store: TrackerReplicaStore

    init(root: URL? = nil) {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        store = TrackerReplicaStore(root: root ?? support.appendingPathComponent("HarnessSealedSessions"))
    }

    func enter(_ authority: String) { store.enter(authority) }
    func purge() { store.purge() }

    func database() throws -> TrackerReplicaSQLite {
        try store.sealedDatabase()
    }

    func cursor(_ scope: String) throws -> Int64 {
        try database().rows("SELECT seq FROM sealed_cursor WHERE scope = ?", [scope])
            .first?.first.flatMap { $0 }.flatMap(Int64.init) ?? 0
    }

    func advance(_ change: Int64, scope: String, record: TrackerReplicaSealedRecord?) throws {
        let db = try database()
        try db.transaction {
            guard change > (try cursor(scope)) else { return }
            if let record { try save(record, scope: scope, in: db) }
            try db.run("""
                INSERT INTO sealed_cursor(scope, seq) VALUES (?, ?)
                ON CONFLICT(scope) DO UPDATE SET seq = excluded.seq
                """, [scope, String(change)])
        }
    }

    private func save(_ record: TrackerReplicaSealedRecord, scope: String, in db: TrackerReplicaSQLite) throws {
        guard let revision = Int64(exactly: record.header.revision) else { throw TrackerReplicaError.invalidPage }
        try db.run("""
            INSERT INTO sealed_objects(scope, id, epoch, revision, envelope, category, seq)
            VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM sealed_objects))
            ON CONFLICT(scope, id) DO UPDATE SET epoch = excluded.epoch, revision = excluded.revision,
                envelope = excluded.envelope, category = excluded.category, seq = excluded.seq
            WHERE excluded.epoch >= sealed_objects.epoch AND (excluded.revision > sealed_objects.revision
                OR (excluded.revision = sealed_objects.revision AND sealed_objects.envelope IS NULL))
            """, [scope, RemoteCoding.base64url(record.header.objectId), String(record.header.epoch),
                  String(revision), record.wire, record.category])
        try db.run("""
            UPDATE sealed_objects SET envelope = NULL WHERE rowid IN (
                SELECT id FROM (SELECT rowid AS id, SUM(length(envelope)) OVER (ORDER BY seq DESC) AS bytes
                    FROM sealed_objects WHERE envelope IS NOT NULL) WHERE bytes > 12000000
            )
            """)
    }

    func record(_ id: Data, in scope: TrackerReplicaSessionKeys) throws -> TrackerReplicaSealedRecord? {
        let row = try database().rows("""
            SELECT epoch, envelope FROM sealed_objects WHERE scope = ? AND id = ?
            """, [scope.current.name, RemoteCoding.base64url(id)]).first
        guard let row, let record = try open(row, with: scope) else { return nil }
        guard record.header.objectId == id else { throw TrackerReplicaError.invalidPage }
        return record
    }

    func sessionRecords(in scope: TrackerReplicaSessionKeys) throws -> [TrackerReplicaSealedRecord] {
        let category = try scope.current.objectId(kind: "session", localId: "")
        let rows = try database().rows("""
            SELECT epoch, envelope FROM sealed_objects
            WHERE scope = ? AND category = ? AND envelope IS NOT NULL ORDER BY seq DESC LIMIT 100
            """, [scope.current.name, RemoteCoding.base64url(category)])
        return try rows.compactMap { try open($0, with: scope) }.filter { $0.kind == "session" }
    }

    private func open(_ row: [String?], with scope: TrackerReplicaSessionKeys) throws -> TrackerReplicaSealedRecord? {
        guard let epochValue = row[0], let epoch = UInt32(epochValue),
            let keys = scope.epochs[epoch], let wire = row[1] else { return nil }
        return try TrackerReplicaSealedRecord.open(wire, keys: keys)
    }
}

struct TrackerReplicaSessionKeys {
    let current: SealedScopeKeys
    let epochs: [UInt32: SealedScopeKeys]
}
