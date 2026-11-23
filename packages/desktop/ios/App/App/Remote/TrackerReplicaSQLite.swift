import Foundation
import SQLite3

/// The replica uses platform SQLite and binds every value. SQL is owned by the store.
final class TrackerReplicaSQLite {
    private let db: OpaquePointer
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(path: String) throws {
        var raw: OpaquePointer?
        let mode = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX | SQLITE_OPEN_NOFOLLOW
        let result = sqlite3_open_v2(path, &raw, mode, nil)
        guard result == SQLITE_OK, let db = raw else {
            sqlite3_close(raw)
            throw TrackerReplicaError.database
        }
        self.db = db
        try run("PRAGMA foreign_keys = ON")
        _ = try rows("PRAGMA secure_delete = ON")
        let size = try rows("PRAGMA page_size").first?.first.flatMap { $0 }.flatMap(Int.init) ?? 4096
        let pages = (24 * 1024 * 1024) / size
        let max = try rows("PRAGMA max_page_count = \(pages)").first?.first.flatMap { $0 }.flatMap(Int.init)
        guard let max = max, max <= pages else { throw TrackerReplicaError.database }
    }

    deinit { sqlite3_close(db) }

    func run(_ sql: String, _ bindings: [String?] = []) throws {
        try statement(sql, bindings) { result in
            guard sqlite3_step(result) == SQLITE_DONE else { throw TrackerReplicaError.database }
        }
    }

    func rows(_ sql: String, _ bindings: [String?] = []) throws -> [[String?]] {
        try statement(sql, bindings) { result in
            var values: [[String?]] = []
            var step = sqlite3_step(result)
            while step == SQLITE_ROW {
                values.append((0..<sqlite3_column_count(result)).map { index in
                    sqlite3_column_text(result, index).map { String(cString: $0) }
                })
                step = sqlite3_step(result)
            }
            guard step == SQLITE_DONE else { throw TrackerReplicaError.database }
            return values
        }
    }

    func transaction<T>(_ body: () throws -> T) throws -> T {
        try run("BEGIN IMMEDIATE")
        do {
            let result = try body()
            try run("COMMIT")
            return result
        } catch {
            try? run("ROLLBACK")
            throw error
        }
    }

    private func statement<T>(
        _ sql: String, _ bindings: [String?], _ body: (OpaquePointer) throws -> T
    ) throws -> T {
        var raw: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &raw, nil) == SQLITE_OK, let result = raw
        else { throw TrackerReplicaError.database }
        defer { sqlite3_finalize(result) }
        for (index, value) in bindings.enumerated() {
            let position = Int32(index + 1)
            let status = value.map { sqlite3_bind_text(result, position, $0, -1, transient) }
                ?? sqlite3_bind_null(result, position)
            guard status == SQLITE_OK else { throw TrackerReplicaError.database }
        }
        return try body(result)
    }
}
