import Foundation

@available(iOS 17.0, macOS 14.0, *)
@MainActor
struct TrackerSealedSyncFixture {
    let fixture = TrackerSealedFixture()
    let store = FixtureSealedSecrets()
    let socket = FixtureSealedSocket()
    let hub: FixtureSealedHub
    let account: HubAccountSession
    let authority: TrackerSealedAuthority
    let reader: TrackerSealedSessions
    let admin: SealedDevice
    let device: SealedDevice
    let identity: TrackerSealedIdentity

    init(root: URL) throws {
        identity = TrackerSealedIdentity(
            origin: URL(string: "https://sealed.example.invalid")!, subject: "synthetic-sealed-account",
            bearer: "synthetic-header-only-fixture", generation: 0)
        admin = try SealedDevice.create(enclave: false)
        device = try SealedDevice.create(enclave: false)
        let entry = try Self.genesis(identity: identity, fixture: fixture, admin: admin, device: device)
        let verified = try SealedChain.verify([entry], account: identity.subject)
        authority = TrackerSealedAuthority(identity: identity, keychain: store)
        try SealedDeviceStore.save(device, to: authority)
        try authority.store(verified, scopes: [:])
        hub = FixtureSealedHub(device: device.deviceId, chain: [entry])
        let grant = try SealedGrantCrypto.wrap(account: identity.subject, raw: fixture.scope.raw,
            deviceId: device.deviceId, recipientPublic: device.kemPublic)
        hub.grants = [.object(["account": .string(grant.account), "scope": .string(grant.scope),
            "device": .string(grant.device), "epoch": .int(Int64(grant.epoch)),
            "enc": .string(grant.enc), "ct": .string(grant.ct)])]
        for kind in ["session", "transcript"] {
            let wire = try fixture.record(kind)
            let id = try SealedRecord.header(RemoteCoding.data(base64url: wire)!).objectId
            hub.objects[RemoteCoding.base64url(id)] = wire
        }
        let vault = FixtureAccountVault()
        vault.credential = HubAccountCredential(origin: identity.origin.absoluteString, subject: identity.subject,
            name: "Synthetic account", email: "fixture@example.invalid", token: identity.bearer, expiresAt: .distantFuture)
        account = HubAccountSession(origin: identity.origin, vault: vault, transport: hub)
        reader = TrackerSealedSessions(account: account, cache: TrackerReplicaSealed(root: root),
            keychain: store, live: socket)
    }

    private static func genesis(identity: TrackerSealedIdentity, fixture: TrackerSealedFixture,
        admin: SealedDevice, device: SealedDevice
    ) throws -> SealedChainEntry {
        let scope = [fixture.scope.name]
        let recovery = try SealedDevice.create(enclave: false)
        let devices = [SealedChainDevice(admin, role: "admin", scopes: scope),
            SealedChainDevice(device, role: "admin", scopes: scope),
            SealedChainDevice(recovery, role: "recovery", scopes: scope)]
        return try admin.sign(SealedChainEntry(seq: 0, prev: "", at: 1, body: .object([
            "type": .string("genesis"), "account": .string(identity.subject),
            "devices": .array(devices.map(\.json)),
            "scopes": .array([try SealedScopeCommitment(fixture.scope.raw).json])
        ])))
    }

    func revoke() throws {
        let previous = hub.chain.last!
        let entry = try admin.sign(SealedChainEntry(seq: previous.seq + 1, prev: previous.hash, at: 2,
            body: .object(["type": .string("revoke"), "device": .string(device.deviceId)])))
        hub.chain.append(entry)
    }

    func isSignedRequest(_ request: URLRequest) -> Bool {
        request.url?.host == identity.origin.host && request.url?.scheme == "https"
            && request.url?.path.hasPrefix("/api/sync/v1/") == true
            && request.url?.absoluteString.contains(identity.bearer) == false
            && request.value(forHTTPHeaderField: "Authorization") == "Bearer " + identity.bearer
            && request.value(forHTTPHeaderField: "X-Harness-Device") == device.deviceId
    }
}
