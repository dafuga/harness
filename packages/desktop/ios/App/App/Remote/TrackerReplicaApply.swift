import Foundation

extension TrackerReplicaStore {
    func apply(_ page: TrackerReplicaPage, state: inout TrackerReplicaState, db: TrackerReplicaSQLite) throws -> Bool {
        switch page.kind {
        case "reset":
            try db.run("DELETE FROM items WHERE slot = ?", [String(state.staging)])
            state.cursor = nil
            state.continuation = nil
            state.snapshotId = nil
            state.caughtUpAt = nil
            return true
        case "snapshot":
            return try replace(page, state: &state, db: db)
        case "delta":
            return try advance(page, state: &state, db: db)
        default:
            throw TrackerReplicaError.invalidPage
        }
    }

    private func replace(
        _ page: TrackerReplicaPage, state: inout TrackerReplicaState, db: TrackerReplicaSQLite
    ) throws -> Bool {
        guard page.validSnapshot, state.cursor == nil, state.continuation == page.requestContinuation,
            let rows = page.rows, let stamp = page.hubTime,
            TrackerReplicaItem.short(stamp, 40), let partial = page.partial
        else { throw TrackerReplicaError.invalidPage }
        let stage = String(state.staging)
        if state.continuation == nil {
            try db.run("DELETE FROM items WHERE slot = ?", [stage])
        } else if state.snapshotId != page.snapshotId || state.continuation == page.continuation {
            throw TrackerReplicaError.invalidPage
        }
        for row in rows { try put(row, slot: stage, db: db) }
        state.snapshotId = page.snapshotId
        state.continuation = page.continuation
        guard let cursor = page.cursor else { return true }
        try db.run("DELETE FROM items WHERE slot = ?", [String(state.slot)])
        state.slot = state.staging
        state.snapshotId = nil
        state.cursor = cursor
        state.lastSyncedAt = stamp
        state.caughtUpAt = nil
        state.partial = partial
        return true
    }

    private func advance(
        _ page: TrackerReplicaPage, state: inout TrackerReplicaState, db: TrackerReplicaSQLite
    ) throws -> Bool {
        guard page.validDelta, let current = state.cursor, current == page.requestCursor,
            let operations = page.operations, let stamp = page.hubTime, TrackerReplicaItem.short(stamp, 40),
            let partial = page.partial, let more = page.hasMore
        else { throw TrackerReplicaError.invalidPage }
        let slot = String(state.slot)
        for operation in operations {
            try db.run("DELETE FROM items WHERE slot = ? AND id = ?", [slot, operation.id])
            if let row = operation.row { try put(row, slot: slot, db: db) }
        }
        state.cursor = page.cursor
        state.partial = partial
        state.caughtUpAt = nil
        if !more { state.lastSyncedAt = stamp }
        return more
    }

    private func put(_ row: TrackerReplicaItem, slot: String, db: TrackerReplicaSQLite) throws {
        try db.run("""
            INSERT INTO items (slot, id, folded, project, status, updated, value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [slot, row.id, trackerFold(row.id + " " + row.title), row.project, row.status,
                  row.updatedAt, try TrackerReplicaJSON.string(row.header)])
        let children = [try row.notes.map(TrackerReplicaJSON.string),
                        try row.flag.map { [try TrackerReplicaJSON.string($0)] } ?? [],
                        try row.runs.map(TrackerReplicaJSON.string),
                        row.attentionRevision.map { [$0] } ?? []]
        for (table, values) in zip(["notes", "flags", "runs", "attention"], children) {
            for (index, value) in values.enumerated() {
                try db.run("INSERT INTO \(table) VALUES (?, ?, ?, ?)", [slot, row.id, String(index), value])
            }
        }
    }
}

func trackerFold(_ value: String) -> String {
    value.folding(options: .caseInsensitive, locale: Locale(identifier: "en_US_POSIX"))
}
