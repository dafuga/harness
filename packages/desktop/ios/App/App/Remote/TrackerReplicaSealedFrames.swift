import Foundation

struct TrackerReplicaLiveFrame {
    let ring: Int64
    let envelope: Data
    let header: SealedFrameHeader

    init(_ message: Data) throws {
        guard message.count >= 69, message.count <= 256 * 1024 + 8,
            let ring = Int64(exactly: SealedBytes.readU64(message, at: 0)), ring > 0 else {
            throw TrackerReplicaError.invalidPage
        }
        self.ring = ring
        envelope = Data(message.dropFirst(8))
        header = try SealedFrame.header(envelope)
    }

    func open(keys: SealedScopeKeys) throws -> Data {
        let stream = try SealedStream(keys: keys, id: header.streamId)
        return try SealedPadding.unpad(SealedFrame.open(envelope, keys: keys, stream: stream).data)
    }
}

extension TrackerReplicaSealed {
    func ring() throws -> Int64 {
        try database().rows("SELECT position FROM sealed_ring WHERE id = 1")
            .first?.first.flatMap { $0 }.flatMap(Int64.init) ?? 0
    }

    func resetRing() throws {
        try database().run("DELETE FROM sealed_ring")
    }

    func accept(_ frame: TrackerReplicaLiveFrame, keys: SealedScopeKeys) throws {
        _ = try frame.open(keys: keys)
        let db = try database()
        let stream: [String?] = [keys.name, String(keys.epoch), RemoteCoding.base64url(frame.header.streamId)]
        let counter = counterText(frame.header.counter)
        try db.transaction {
            let highest = try db.rows("SELECT counter FROM sealed_streams WHERE scope = ? AND epoch = ? AND stream = ?", stream)
                .first?.first.flatMap { $0 }
            if highest.map({ $0 < counter }) ?? true {
                try saveFrame(frame, address: stream + [counter], in: db)
            }
            try db.run("""
                DELETE FROM sealed_frames WHERE rowid IN (
                    SELECT id FROM (SELECT rowid AS id, ROW_NUMBER() OVER (ORDER BY received DESC) AS position,
                        SUM(length(envelope)) OVER (ORDER BY received DESC) AS bytes FROM sealed_frames)
                    WHERE position > 64 OR bytes > 4000000
                )
                """)
            try db.run("""
                INSERT INTO sealed_ring(id, position) VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET position = MAX(position, excluded.position)
                """, [String(frame.ring)])
        }
    }

    private func saveFrame(_ frame: TrackerReplicaLiveFrame, address: [String?], in db: TrackerReplicaSQLite) throws {
        try db.run("""
            INSERT INTO sealed_frames(scope, epoch, stream, counter, envelope, received)
            VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(received), 0) + 1 FROM sealed_frames))
            """, address + [RemoteCoding.base64url(frame.envelope)])
        try db.run("""
            INSERT INTO sealed_streams(scope, epoch, stream, counter) VALUES (?, ?, ?, ?)
            ON CONFLICT(scope, epoch, stream) DO UPDATE SET counter = excluded.counter
            """, address)
    }

    func liveBytes(stream id: Data, keys: SealedScopeKeys, after: UInt64?) throws -> [(UInt64, Data)] {
        let db = try database()
        let rows = try db.rows("""
            SELECT envelope FROM sealed_frames WHERE scope = ? AND epoch = ? AND stream = ?
            AND (? IS NULL OR counter > ?) ORDER BY counter LIMIT 8
            """, [keys.name, String(keys.epoch), RemoteCoding.base64url(id), after.map(counterText),
                  after.map(counterText)])
        let stream = try SealedStream(keys: keys, id: id)
        return try rows.map { row in
            guard let envelope = row[0].flatMap({ RemoteCoding.data(base64url: $0) }) else {
                throw TrackerReplicaError.database
            }
            let frame = try SealedFrame.open(envelope, keys: keys, stream: stream)
            guard frame.header.streamId == id else { throw TrackerReplicaError.invalidPage }
            return (frame.header.counter, try SealedPadding.unpad(frame.data))
        }
    }

    private func counterText(_ counter: UInt64) -> String {
        String(format: "%020llu", counter)
    }
}
