import Foundation

extension TrackerSealedHub {
    @MainActor
    func catchUp(_ cache: TrackerReplicaSealed, scope: TrackerReplicaSessionKeys) async throws {
        let name = scope.current.name
        for _ in 0..<100 {
            let cursor = try cache.cursor(name)
            let data = try await get("objects/\(name)", query: ["after": String(cursor)])
            let json = try SealedJson.parse(data)
            guard let objects = json["objects"]?.items, objects.count <= 200,
                let next = json["next"]?.number, let more = json["more"], more == .bool(true) || more == .bool(false)
            else { throw TrackerReplicaError.invalidPage }
            var previous = cursor
            for entry in objects {
                let object = try TrackerSealedObject(entry, after: previous)
                let record = try await fetch(object, scope: scope)
                try Task.checkCancellation()
                try cache.advance(object.change, scope: name, record: record)
                previous = object.change
            }
            guard previous == next else { throw TrackerReplicaError.invalidPage }
            if more == .bool(false) { return }
            if previous == cursor { throw TrackerReplicaError.invalidPage }
        }
        throw HubAccountFailure.tooLarge
    }

    func fetch(_ object: TrackerSealedObject, scope: TrackerReplicaSessionKeys) async throws -> TrackerReplicaSealedRecord? {
        let data = try await get("objects/\(scope.current.name)/\(RemoteCoding.base64url(object.id))")
        guard data.count <= 5_592_408, let wire = String(data: data, encoding: .utf8),
            let bytes = RemoteCoding.data(base64url: wire), bytes.count <= 4 * 1024 * 1024,
            RemoteCoding.base64url(bytes) == wire else { throw TrackerReplicaError.invalidPage }
        let header = try SealedRecord.header(bytes)
        guard header.scopeId == scope.current.scopeId, header.objectId == object.id,
            header.revision >= object.revision, header.epoch <= scope.current.epoch
        else { throw TrackerReplicaError.invalidPage }
        guard let keys = scope.epochs[header.epoch] else { return nil }
        return try TrackerReplicaSealedRecord.open(wire, keys: keys)
    }
}

struct TrackerSealedObject {
    let id: Data
    let revision: UInt64
    let change: Int64

    init(_ entry: SealedJson, after: Int64) throws {
        guard let name = entry["id"]?.text, let id = RemoteCoding.data(base64url: name), id.count == 32,
            RemoteCoding.base64url(id) == name, let change = entry["change"]?.number, change > after,
            let revision = entry["revision"]?.number.flatMap(UInt64.init(exactly:)),
            let size = entry["size"]?.number, (105...4 * 1024 * 1024).contains(size) else {
            throw TrackerReplicaError.invalidPage
        }
        (self.id, self.revision, self.change) = (id, revision, change)
    }
}
