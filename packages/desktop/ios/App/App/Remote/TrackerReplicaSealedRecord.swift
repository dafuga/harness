import Foundation

/// The publisher's session and transcript records. The object id must bind the decrypted identity.
struct TrackerReplicaSealedRecord {
    let wire: String
    let header: SealedRecordHeader
    let category: String
    let kind: String
    let runId: String
    let json: SealedJson

    static func open(_ wire: String, keys: SealedScopeKeys) throws -> TrackerReplicaSealedRecord? {
        guard wire.utf8.count <= 5_592_408, let bytes = RemoteCoding.data(base64url: wire),
            RemoteCoding.base64url(bytes) == wire else { throw TrackerReplicaError.invalidPage }
        let opened = try SealedRecord.open(bytes, keys: keys)
        guard let object = RemoteCoding.object(opened.json),
            let kind = object["kind"] as? String, kind == "session" || kind == "transcript" else { return nil }
        let json = try SealedJson.from(object.filter { ["runId", "status", "streamId", "index", "data"].contains($0.key) })
        guard let run = json["runId"]?.text, !run.isEmpty, run.utf8.count <= 256 else {
            throw TrackerReplicaError.invalidPage
        }
        let localId = try objectName(kind, run: run, json: json)
        guard try keys.objectId(kind: kind, localId: localId) == opened.header.objectId else {
            throw TrackerReplicaError.invalidPage
        }
        let category = try keys.objectId(kind: kind, localId: "")
        return TrackerReplicaSealedRecord(wire: wire, header: opened.header,
            category: RemoteCoding.base64url(category), kind: kind, runId: run, json: json)
    }

    static func segmentId(_ run: String, _ index: Int64) -> String {
        SealedJson.array([.string(run), .int(index)]).canonical
    }

    private static func objectName(_ kind: String, run: String, json: SealedJson) throws -> String {
        if kind == "session", json["status"]?.text != nil,
            json["streamId"]?.text.flatMap({ RemoteCoding.data(base64url: $0) })?.count == 16 { return run }
        if kind == "transcript", let index = json["index"]?.number, index >= 0,
            let encoded = json["data"]?.text, encoded.utf8.count <= 174_763,
            RemoteCoding.data(base64url: encoded) != nil { return segmentId(run, index) }
        throw TrackerReplicaError.invalidPage
    }
}
