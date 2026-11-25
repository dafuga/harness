import Foundation

extension TrackerReplicaSealed {
    func sessions(_ scopes: [String: TrackerReplicaSessionKeys]) throws -> [[String: Any]] {
        try scopes.keys.sorted().flatMap { name -> [[String: Any]] in
            guard let scope = scopes[name] else { return [] }
            return try sessionRecords(in: scope).map {
                ["scope": name, "runId": $0.runId, "status": $0.json["status"]?.text ?? ""]
            }
        }
    }

    func transcript(_ run: String, index: Int64, keys: TrackerReplicaSessionKeys) throws -> Data? {
        guard index >= 0 else { throw TrackerReplicaError.invalidPage }
        let id = try keys.current.objectId(kind: "transcript",
            localId: TrackerReplicaSealedRecord.segmentId(run, index))
        return try record(id, in: keys)?.json["data"]?.text.flatMap({ RemoteCoding.data(base64url: $0) })
    }

    func live(_ run: String, keys: TrackerReplicaSessionKeys, cursor: TrackerReplicaFrameCursor) throws -> [String: Any] {
        let id = try keys.current.objectId(kind: "session", localId: run)
        guard let session = try record(id, in: keys), let epoch = keys.epochs[session.header.epoch],
            let name = session.json["streamId"]?.text, let stream = RemoteCoding.data(base64url: name)
        else { return ["frames": []] }
        let after = cursor.stream == name ? cursor.counter : nil
        let frames = try liveBytes(stream: stream, keys: epoch, after: after)
        return ["stream": name, "frames": frames.map {
            ["counter": String($0.0), "data": $0.1.base64EncodedString()]
        }]
    }
}

struct TrackerReplicaFrameCursor {
    let stream: String?
    let counter: UInt64?
}
