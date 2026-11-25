import Foundation

/// Phase 1: Swift makes keys, a signed chain, a grant for TypeScript's device, a record, a frame
/// and a recovery blob. TypeScript then has to accept every one.
@available(iOS 17.0, macOS 14.0, *)
struct InteropExport {
    let folder: URL
    var files: InteropFiles { InteropFiles(folder: folder) }

    func run() throws {
        let theirs = try files.read("ts-device.json")
        let phone = try (try? SealedDevice.create(enclave: true)) ?? SealedDevice.create(enclave: false)
        try SealedDeviceStore.save(phone, to: FileStore(folder: folder))
        let raw = SealedRawScopeKeys.make()
        let keys = try SealedScopeKeys(raw)
        let chain = try signedChain(phone, theirs, raw)
        let grant = try SealedGrantCrypto.wrap(
            account: "interop", raw: raw, deviceId: try files.text(theirs, "deviceId"),
            recipientPublic: try files.bytes(theirs, "kemPublic"))
        var out = try sealed(keys, raw)
        out["enclave"] = .bool(phone.kem.isEnclave)
        out["deviceId"] = .string(phone.deviceId)
        out["kemPublic"] = .string(RemoteCoding.base64url(phone.kemPublic))
        out["signingPublic"] = .string(RemoteCoding.base64url(phone.signingPublic))
        out["chain"] = .array(chain.map(\.json))
        out["grant"] = .object([
            "account": .string(grant.account), "scope": .string(grant.scope),
            "epoch": .int(Int64(grant.epoch)), "device": .string(grant.device),
            "enc": .string(grant.enc), "ct": .string(grant.ct)
        ])
        try files.write("swift-out.json", .object(out))
        print("exported (Secure Enclave: \(phone.kem.isEnclave))")
    }

    /// Genesis by the Swift device, then an `enroll` of TypeScript's device.
    private func signedChain(
        _ phone: SealedDevice, _ theirs: SealedJson, _ raw: SealedRawScopeKeys
    ) throws -> [SealedChainEntry] {
        let scope = RemoteCoding.base64url(raw.scopeId)
        let own = SealedChainDevice(phone, role: "admin", scopes: [scope]).json
        let genesis = try phone.sign(SealedChainEntry(seq: 0, prev: "", at: 1, body: .object([
            "type": .string("genesis"), "account": .string("interop"), "devices": .array([own]),
            "scopes": .array([try SealedScopeCommitment(raw).json])
        ])))
        let enroll = try phone.sign(SealedChainEntry(seq: 1, prev: genesis.hash, at: 2, body: .object([
            "type": .string("enroll"), "device": try files.chainDevice(theirs, role: "admin", scopes: [scope])
        ])))
        return [genesis, enroll]
    }

    /// A record, a frame and a recovery blob, with the keys that open them.
    private func sealed(_ keys: SealedScopeKeys, _ raw: SealedRawScopeKeys) throws -> [String: SealedJson] {
        let objectId = try keys.objectId(kind: "item", localId: "swift")
        let record = try SealedRecord.seal(
            Data(#"{"kind":"item","title":"from swift"}"#.utf8), keys: keys,
            object: SealedObjectRef(objectId: objectId, revision: 4))
        let stream = try SealedStream(keys: keys, id: RemoteCoding.random(16))
        let frame = try SealedFrame.seal(Data("swift frame".utf8), keys: keys, stream: stream, counter: 7)
        let recovery = try SealedDevice.create(enclave: false)
        let secret = SealedRecovery.newSecret()
        let b64 = RemoteCoding.base64url
        return [
            "scopeKeys": .object(["scopeId": .string(keys.name), "epoch": .int(0), "dataKey": .string(b64(raw.dataKey)), "indexKey": .string(b64(raw.indexKey))]),
            "record": .string(b64(record)), "frame": .string(b64(frame)), "streamId": .string(b64(stream.id)),
            "recovery": .string(try SealedRecovery.seal(recovery, secret: secret)),
            "recoverySecret": .string(b64(secret)), "recoveryDevice": .string(recovery.deviceId)
        ]
    }
}

/// Opaque device blobs in a folder: the Secure Enclave key blob only works on this device.
struct FileStore: SealedSecretStore {
    let folder: URL
    func load(_ name: String) -> Data? { try? Data(contentsOf: folder.appendingPathComponent(name)) }
    func save(_ name: String, _ data: Data) throws { try data.write(to: folder.appendingPathComponent(name)) }
    func remove(_ name: String) { try? FileManager.default.removeItem(at: folder.appendingPathComponent(name)) }
}
