import Foundation
import Darwin

/// The database is owned by one pairing scope and used only on the RemoteSession queue.
final class TrackerReplicaStore {
    let now: () -> Date
    private let root: URL
    private let files = FileManager.default
    private var scope: String?
    private var entered = false
    private var connection: TrackerReplicaSQLite?

    init(root: URL? = nil, now: @escaping () -> Date = Date.init) {
        self.now = now
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.root = root ?? support.appendingPathComponent("HarnessTracker", isDirectory: true)
    }

    func enter(_ next: String?) {
        guard !entered || next != scope else { return }
        entered = true
        connection = nil
        scope = next
        for child in (try? files.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] {
            if child.lastPathComponent != next { try? files.removeItem(at: child) }
        }
    }

    func purge() {
        connection = nil
        scope = nil
        try? files.removeItem(at: root)
    }

    func state() throws -> TrackerReplicaState {
        guard let value = try db().rows("SELECT value FROM metadata WHERE id = 1").first?.first
        else { return TrackerReplicaState() }
        return try TrackerReplicaJSON.decode(TrackerReplicaState.self, value)
    }

    func apply(_ page: TrackerReplicaPage, expected: TrackerReplicaState, now: Date) throws -> Bool {
        let db = try db()
        return try db.transaction {
            var state = try self.state()
            guard state.input as NSDictionary == expected.input as NSDictionary else {
                throw TrackerReplicaError.invalidPage
            }
            let more = try apply(page, state: &state, db: db)
            if page.kind == "snapshot" || page.kind == "delta" {
                state.renewedAt = now.timeIntervalSince1970
                if !more, page.kind == "delta" { state.caughtUpAt = state.renewedAt }
            }
            try db.run("""
                INSERT INTO metadata (id, value) VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET value = excluded.value
                """, [try TrackerReplicaJSON.string(state)])
            return more
        }
    }

    func db() throws -> TrackerReplicaSQLite {
        if let connection = connection { return connection }
        guard let scope = scope else { throw TrackerReplicaError.database }
        let directory = root.appendingPathComponent(scope, isDirectory: true)
        do {
            let database = try open(directory)
            connection = database
            return database
        } catch TrackerReplicaError.unsupportedSchema {
            try files.removeItem(at: directory)
            let database = try open(directory)
            connection = database
            return database
        }
    }

    private func open(_ directory: URL) throws -> TrackerReplicaSQLite {
        #if os(iOS)
        let protection: [FileAttributeKey: Any] = [
            .protectionKey: FileProtectionType.completeUntilFirstUserAuthentication
        ]
        #else
        let protection: [FileAttributeKey: Any] = [.posixPermissions: 0o700]
        #endif
        try files.createDirectory(at: directory, withIntermediateDirectories: true, attributes: protection)
        var folder = root
        var noBackup = URLResourceValues()
        noBackup.isExcludedFromBackup = true
        try folder.setResourceValues(noBackup)
        guard let canonical = realpath(directory.path, nil) else { throw TrackerReplicaError.database }
        defer { free(canonical) }
        let path = String(cString: canonical) + "/tracker.sqlite"
        let db = try TrackerReplicaSQLite(path: path)
        try files.setAttributes(protection, ofItemAtPath: path)
        try createSchema(db)
        try db.run("""
            CREATE TABLE IF NOT EXISTS attention (
                slot INTEGER NOT NULL, item TEXT NOT NULL, position INTEGER NOT NULL, value TEXT NOT NULL,
                PRIMARY KEY (slot, item, position),
                FOREIGN KEY (slot, item) REFERENCES items (slot, id) ON DELETE CASCADE
            )
            """)
        return db
    }

}

extension TrackerReplicaStore {
    private func createSchema(_ db: TrackerReplicaSQLite) throws {
        let version = try db.rows("PRAGMA user_version").first?.first.flatMap { $0 }
        if version == "1" { return }
        guard version == "0" else { throw TrackerReplicaError.unsupportedSchema }
        try db.transaction {
            try db.run("CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)")
            try db.run("""
                CREATE TABLE items (
                    slot INTEGER NOT NULL, id TEXT NOT NULL, folded TEXT NOT NULL,
                    project TEXT NOT NULL, status TEXT NOT NULL, updated TEXT, value TEXT NOT NULL,
                    PRIMARY KEY (slot, id))
                """)
            try db.run("CREATE INDEX items_recency ON items(slot, updated DESC, id)")
            try db.run("CREATE INDEX items_project ON items(slot, project, updated DESC, id)")
            try db.run("CREATE INDEX items_status ON items(slot, status, updated DESC, id)")
            for table in ["notes", "flags", "runs"] {
                try db.run("""
                    CREATE TABLE \(table) (
                        slot INTEGER NOT NULL, item TEXT NOT NULL, position INTEGER NOT NULL, value TEXT NOT NULL,
                        PRIMARY KEY (slot, item, position),
                        FOREIGN KEY (slot, item) REFERENCES items (slot, id) ON DELETE CASCADE)
                    """)
            }
            try db.run("PRAGMA user_version = 1")
        }
    }
}
