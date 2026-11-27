import Foundation

@available(iOS 17.0, macOS 14.0, *)
func verifyLoginGrants(_ bench: AccountBench, admin: SealedDevice, genesis: SealedChainEntry, scope: SealedRawScopeKeys) throws {
    let route = "/api/sync/v1/grants", open = "/api/sync/v1/enroll"
    guard let own = bench.hub.asked(open).first?.value(forHTTPHeaderField: "X-Harness-Device"),
          let fields = bench.hub.body(open) as? [String: String],
          let kem = fields["kemPublic"].flatMap(RemoteCoding.data(base64url:)),
          let signing = fields["signingPublic"].flatMap(RemoteCoding.data(base64url:)),
          let actor = bench.vault.credential?.subject else { throw HubAccountFailure.failed }
    let keys = SealedEnrollKeys(kemPublic: kem, signingPublic: signing)
    let opening = EnrollOpening(deviceId: own, keys: keys, commit: fields["commit"] ?? "")
    let device = try opening.chainDevice(scopes: [RemoteCoding.base64url(scope.scopeId)])
    let entry = try admin.sign(SealedChainEntry(seq: 1, prev: genesis.hash, at: 2,
        body: .object(["type": .string("enroll"), "device": device.json])))
    bench.hub.routes["GET /api/sync/v1/device-session"] = { _ in hubJSON(200, ["state": "approved"]) }
    bench.hub.routes["GET " + route] = { _ in hubJSON(200, ["grants": []]) }
    check(bench.status()?.refusal != nil, "grants: the approved status waits for the signed enrollment")
    bench.hub.routes["GET /api/sync/v1/chain"] = { _ in
        let wire = SealedJson.object(["entries": .array([genesis.json, entry.json]), "more": .bool(false)])
        return HubAccountReply(status: 200, contentType: "application/json", data: Data(wire.canonical.utf8))
    }
    check(bench.status()?.refusal != nil, "grants: signed enrollment waits for every current wrapped grant")
    let grant = try SealedGrantCrypto.wrap(account: actor, raw: scope, deviceId: own, recipientPublic: kem)
    let envelope: [String: Any] = ["account": actor, "scope": grant.scope, "epoch": grant.epoch,
        "device": own, "enc": grant.enc, "ct": grant.ct]
    bench.hub.routes["GET " + route] = { _ in hubJSON(200, ["grants": [envelope]]) }
    let admitted = try bench.status()?.get()
    let recovered = bench.session.queue.sync { bench.session.enrolledDevice?.keys[RemoteCoding.base64url(scope.scopeId)] }
    check(recovered?.dataKey == SealedBytes.key(scope.dataKey) && admitted?["state"] as? String == "signed-in" && bench.hub.asked(route).last?.value(forHTTPHeaderField: "X-Harness-Device") == own,
          "grants: the enrolled phone opens its recipient grant before exposing the account")
    try verifyRetainedAdmission(bench, admin: admin, genesis: genesis, device: device)
}

@available(iOS 17.0, macOS 14.0, *)
private func verifyRetainedAdmission(_ bench: AccountBench, admin: SealedDevice,
                                     genesis: SealedChainEntry, device: SealedChainDevice) throws {
    let restarted = AccountBench(vault: bench.vault)
    restarted.time = bench.time
    let path = "GET /api/sync/v1/chain"
    restarted.hub.routes["GET /api/sync/v1/grants"] = bench.hub.routes["GET /api/sync/v1/grants"]
    restarted.hub.routes[path] = bench.hub.routes[path]
    let restored = try restarted.status()?.get()
    check(restored?["state"] as? String == "signed-in", "grants: a relaunch reopens the enrolled phone's grants")
    let fork = try admin.sign(SealedChainEntry(seq: 1, prev: genesis.hash, at: 3,
        body: .object(["type": .string("enroll"), "device": device.json])))
    restarted.hub.routes[path] = { _ in
        let wire = SealedJson.object(["entries": .array([genesis.json, fork.json]), "more": .bool(false)])
        return HubAccountReply(status: 200, contentType: "application/json", data: Data(wire.canonical.utf8))
    }
    let refused = restarted.status()?.refusal
    let discarded = restarted.session.queue.sync { restarted.session.enrolledDevice == nil }
    check(refused != nil && discarded, "grants: a signed fork of the admitted head clears access on relaunch")
}

/// Existing account checks exercise an already admitted first installation, including cold starts.
func installGenesisReplies(_ hub: FakeHub, vault: MemoryAccountVault) {
    for name in ["chain", "grants"] {
        hub.routes["GET /api/sync/v1/" + name] = { request in
            guard #available(iOS 17.0, macOS 14.0, *), let credential = vault.credential,
                let id = request.value(forHTTPHeaderField: "X-Harness-Device") else { return hubJSON(403, [:]) }
            do {
                if vault.firstDeviceReplies[id] == nil {
                    let store = try HubLoginDeviceStore(credential, base: vault.deviceKeys)
                    guard let device = try SealedDeviceStore.load(from: store), device.deviceId == id
                    else { return hubJSON(403, [:]) }
                    vault.firstDeviceReplies[id] = try genesisReplies(device, actor: credential.subject)
                }
                return vault.firstDeviceReplies[id]?[name] ?? hubJSON(404, [:])
            } catch { return hubJSON(500, [:]) }
        }
    }
}

@available(iOS 17.0, macOS 14.0, *)
private func genesisReplies(_ device: SealedDevice, actor: String) throws -> [String: HubAccountReply] {
    let scope = SealedRawScopeKeys.make()
    let genesis = try comparisonGenesis(device, actor: actor, scope: scope)
    let wire = SealedJson.object(["entries": .array([genesis.json]), "more": .bool(false)])
    let grant = try SealedGrantCrypto.wrap(account: actor, raw: scope, deviceId: device.deviceId, recipientPublic: device.kemPublic)
    return ["chain": HubAccountReply(status: 200, contentType: "application/json", data: Data(wire.canonical.utf8)),
            "grants": hubJSON(200, ["grants": [["account": actor, "scope": grant.scope, "epoch": grant.epoch,
                "device": grant.device, "enc": grant.enc, "ct": grant.ct]]])]
}
