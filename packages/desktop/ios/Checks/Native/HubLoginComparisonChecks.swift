import Foundation

/// The Hub fixtures carry only synthetic keys. The requester and approver compute their code independently.
func verifyLoginComparison(_ bench: AccountBench) {
    let path = "/api/sync/v1/enroll", id = String(repeating: "a", count: 32)
    let open = bench.hub.asked(path).first
    guard let opening = open?.httpBody, let own = open?.value(forHTTPHeaderField: "X-Harness-Device"),
        let keys = RemoteCoding.object(opening) as? [String: String],
        let kem = keys["kemPublic"].flatMap(RemoteCoding.data(base64url:)),
        let signing = keys["signingPublic"].flatMap(RemoteCoding.data(base64url:)),
        let actor = bench.vault.credential?.subject else { return check(false, "comparison: fixture has an opening") }
    do {
        let admin = try SealedDevice.create(enclave: false)
        let scope = SealedRawScopeKeys.make()
        let genesis = try comparisonGenesis(admin, actor: actor, scope: scope)
        bench.hub.routes["GET /api/sync/v1/chain"] = { _ in
            HubAccountReply(status: 200, contentType: "application/json",
                            data: Data(SealedJson.object(["entries": .array([genesis.json]), "more": .bool(false)]).canonical.utf8))
        }
        let nonce = RemoteCoding.random(32)
        var claim = RemoteCoding.json(["approver": admin.deviceId, "nonce": RemoteCoding.base64url(nonce)])!
        let route = path + "/" + id
        var reveal: [String: Any]?
        bench.hub.routes["GET " + route] = { _ in
            var steps: [[String: Any]] = [["n": 0, "by": own, "body": String(decoding: opening, as: UTF8.self)],
                ["n": 1, "by": admin.deviceId, "body": String(decoding: claim, as: UTF8.self)]]
            if let reveal { steps.append(reveal) }
            return hubJSON(200, ["id": id, "steps": steps])
        }
        bench.hub.routes["POST " + route] = { request in
            let step: [String: Any] = ["n": 2, "by": own, "body": String(decoding: request.httpBody ?? Data(), as: UTF8.self)]
            reveal = step
            return hubJSON(201, step)
        }
        let fork = try comparisonGenesis(admin, actor: actor, scope: scope)
        guard try refusesForkBeforeReveal(bench, pinned: genesis, fork: fork, mailbox: route) else { return }
        let status = try bench.status()?.get()
        let raw = (bench.hub.body(route)["nonce"] as? String).flatMap(RemoteCoding.data(base64url:)) ?? Data()
        let publicKeys = SealedEnrollKeys(kemPublic: kem, signingPublic: signing)
        let code = try? SealedEnroll.code(request: publicKeys, requestNonce: raw, approverSigningPublic: admin.signingPublic, approverNonce: nonce)
        check(code != nil && status?["verificationCode"] as? String == code &&
              status?["state"] as? String == "waiting-for-approval" && status?["actor"] == nil,
              "comparison: a verified approver and waiting phone show the same code before any grant")
        let repeated = try bench.status()?.get()
        check(code != nil && repeated?["verificationCode"] as? String == code && bench.hub.asked(route).filter { $0.httpMethod == "POST" }.count == 1,
              "comparison: polling a revealed transcript keeps the code and sends no second reveal")
        claim = RemoteCoding.json(["approver": admin.deviceId, "nonce": RemoteCoding.base64url(RemoteCoding.random(32))])!
        check(bench.status()?.refusal != nil, "comparison: a changed claim cannot replace the locked transcript")
        if #available(iOS 17.0, macOS 14.0, *) {
            try verifyLoginGrants(bench, admin: admin, genesis: genesis, scope: scope)
        }
    } catch { check(false, "comparison: the synthetic approval transcript completes") }
}

func comparisonGenesis(_ admin: SealedDevice, actor: String, scope: SealedRawScopeKeys) throws -> SealedChainEntry {
    let recovery = try SealedDevice.create(enclave: false)
    let id = RemoteCoding.base64url(scope.scopeId)
    let body = SealedJson.object(["type": .string("genesis"), "account": .string(actor),
        "devices": .array([SealedChainDevice(admin, role: "admin", scopes: [id]).json,
                           SealedChainDevice(recovery, role: "recovery", scopes: [id]).json]),
        "scopes": .array([try SealedScopeCommitment(scope).json])])
    return try admin.sign(SealedChainEntry(seq: 0, prev: "", at: 1, body: body))
}

private func refusesForkBeforeReveal(_ bench: AccountBench, pinned: SealedChainEntry,
                                     fork: SealedChainEntry, mailbox: String) throws -> Bool {
    guard let credential = bench.vault.credential else { throw HubAccountFailure.signedOut }
    let store = try HubLoginDeviceStore(credential, base: bench.session.loginPins)
    let saved = SealedChainPin(seq: pinned.seq, head: pinned.hash)
    try store.save(HubLoginAdmission.pinName, JSONEncoder().encode(saved))
    let path = "GET /api/sync/v1/chain"
    let original = bench.hub.routes[path]
    defer { bench.hub.routes[path] = original }
    bench.hub.routes[path] = { _ in
        let wire = SealedJson.object(["entries": .array([fork.json]), "more": .bool(false)])
        return HubAccountReply(status: 200, contentType: "application/json", data: Data(wire.canonical.utf8))
    }
    let refused = bench.status()?.refusal != nil
    let revealed = bench.hub.asked(mailbox).contains { $0.httpMethod == "POST" }
    check(refused && !revealed, "comparison: a remembered account head refuses a fork before reveal")
    return refused && !revealed
}
