import Foundation

/// The native credential is only used to sign fixed sync routes.
struct TrackerSealedIdentity {
    let origin: URL
    let subject: String
    let bearer: String
    let generation: Int

    var namespace: String {
        Self.namespace(origin: origin.absoluteString, subject: subject)
    }

    static func namespace(origin: String, subject: String) -> String {
        RemoteCoding.hex(RemoteCoding.sha256(Data("\(origin)\0\(subject)".utf8)))
    }
}

/// Reads the same origin/account enrollment namespace as the device approval flow.
@available(iOS 17.0, macOS 14.0, *)
struct TrackerSealedAuthority: SealedSecretStore {
    let identity: TrackerSealedIdentity
    var keychain: SealedSecretStore = SealedKeychain()

    func load(_ name: String) -> Data? { keychain.load("enroll-\(identity.namespace)-" + name) }
    func save(_ name: String, _ bytes: Data) throws {
        try keychain.save("enroll-\(identity.namespace)-" + name, bytes)
    }
    func remove(_ name: String) { keychain.remove("enroll-\(identity.namespace)-" + name) }
    func forgetKeys() { remove("session-scope-keys") }

    func pin() throws -> SealedChainPin? {
        guard let data = load("pin") else { return nil }
        return try Self.readPin(SealedJson.parse(data))
    }

    private static func readPin(_ json: SealedJson) throws -> SealedChainPin {
        guard let seq = json["seq"]?.number, seq >= 0, let head = json["head"]?.text,
            HubAccountPolicy.matches(head, "\\A[0-9a-f]{64}\\z") else {
            throw TrackerReplicaError.invalidPage
        }
        return SealedChainPin(seq: seq, head: head)
    }

    func cached(_ pin: SealedChainPin) throws -> [String: TrackerReplicaSessionKeys] {
        guard let bytes = load("session-scope-keys") else { return [:] }
        let json = try SealedJson.parse(bytes)
        guard let actual = json["pin"], try Self.readPin(actual) == pin,
            let rows = json["scopes"]?.items else { return [:] }
        var result: [String: TrackerReplicaSessionKeys] = [:]
        for row in rows {
            guard let current = row["current"]?.number.flatMap(UInt32.init(exactly:)),
                let encoded = row["keys"]?.items else { throw TrackerReplicaError.invalidPage }
            let keys = try encoded.map(Self.decodeKey)
            guard let latest = keys.first(where: { $0.epoch == current }) else {
                throw TrackerReplicaError.invalidPage
            }
            result[latest.name] = TrackerReplicaSessionKeys(current: latest,
                epochs: keys.reduce(into: [:]) { $0[$1.epoch] = $1 })
        }
        return result
    }

    func store(_ chain: SealedChainState, scopes: [String: TrackerReplicaSessionKeys]) throws {
        let pin: SealedJson = .object(["seq": .int(chain.seq), "head": .string(chain.head)])
        let rows = scopes.values.map { scope in
            SealedJson.object(["current": .int(Int64(scope.current.epoch)),
                "keys": .array(scope.epochs.values.map(Self.encodeKey))])
        }
        let keys = SealedJson.object(["pin": pin, "scopes": .array(rows)])
        try save("session-scope-keys", Data(keys.canonical.utf8))
        try save("pin", Data(pin.canonical.utf8))
    }

    private static func encodeKey(_ key: SealedScopeKeys) -> SealedJson {
        let raw = key.raw
        return .object(["scope": .string(key.name), "epoch": .int(Int64(key.epoch)),
            "data": .string(RemoteCoding.base64url(raw.dataKey)),
            "index": .string(RemoteCoding.base64url(raw.indexKey))])
    }

    private static func decodeKey(_ row: SealedJson) throws -> SealedScopeKeys {
        guard let scope = row["scope"]?.text.flatMap({ RemoteCoding.data(base64url: $0) }),
            let epoch = row["epoch"]?.number.flatMap(UInt32.init(exactly:)),
            let data = row["data"]?.text.flatMap({ RemoteCoding.data(base64url: $0) }),
            let index = row["index"]?.text.flatMap({ RemoteCoding.data(base64url: $0) })
        else { throw TrackerReplicaError.invalidPage }
        return try SealedScopeKeys(SealedRawScopeKeys(scopeId: scope, epoch: epoch, dataKey: data, indexKey: index))
    }
}

extension HubAccountSession {
    func endSealedIdentity(_ asked: TrackerSealedIdentity) {
        queue.async { if self.generation == asked.generation { self.erase() } }
    }

    func sealedIdentity() async -> TrackerSealedIdentity? {
        await withCheckedContinuation { continuation in
            queue.async {
                guard let origin = self.origin, let kept = self.live() else {
                    return continuation.resume(returning: nil)
                }
                continuation.resume(returning: TrackerSealedIdentity(origin: origin, subject: kept.subject,
                    bearer: kept.token, generation: self.generation))
            }
        }
    }
}
