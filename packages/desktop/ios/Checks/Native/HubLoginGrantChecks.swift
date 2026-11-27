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
    check(admitted?["state"] as? String == "signed-in" && bench.hub.asked(route).last?.value(forHTTPHeaderField: "X-Harness-Device") == own,
          "grants: the enrolled phone opens its recipient grant before exposing the account")
}
