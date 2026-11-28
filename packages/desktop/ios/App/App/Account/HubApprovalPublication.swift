import Foundation

/// The reviewed enrollment and wrapped grants stay together for exact retries.
struct HubApprovalPublication {
    let entry: SealedChainEntry
    let body: Data

    @available(iOS 17.0, macOS 14.0, *)
    init(id: String, opening: EnrollOpening, chain: SealedChainState, via transport: HubApprovalTransport) throws {
        let device = transport.ledger.device
        guard chain.devices[opening.deviceId] == nil,
            let admin = chain.devices[device.deviceId], admin.active, admin.role == "admin", !admin.scopes.isEmpty,
            admin == SealedChainDevice(device, role: "admin", scopes: admin.scopes)
        else { throw HubAccountFailure.refused }
        let recipient = try opening.chainDevice(scopes: admin.scopes)
        let grants = try admin.scopes.map { scope in
            try Self.wrap(scope, opening: opening, chain: chain, keys: transport.admitted.keys)
        }
        let now = Int64(transport.ledger.session.now().timeIntervalSince1970 * 1000)
        let change = SealedJson.object(["type": .string("enroll"), "device": recipient.json])
        entry = try device.sign(SealedChainEntry(seq: chain.seq + 1, prev: chain.head, at: now, body: change))
        let json = SealedJson.object(["enrollment": .string(id), "entries": .array([entry.json]),
                                      "grants": .array(grants.map(\.enrollmentJson))])
        body = Data(json.canonical.utf8)
    }

    @available(iOS 17.0, macOS 14.0, *)
    private static func wrap(_ scope: String, opening: EnrollOpening, chain: SealedChainState,
                             keys: [String: SealedScopeKeys]) throws -> SealedGrant {
        guard let state = chain.scopes[scope], !state.stale, let local = keys[scope],
            local.name == scope, local.epoch == state.epoch,
            state.commitments[local.epoch] == RemoteCoding.base64url(local.commitment)
        else { throw HubAccountFailure.refused }
        return try SealedGrantCrypto.wrap(account: chain.account, raw: local.raw, deviceId: opening.deviceId,
                                          recipientPublic: opening.keys.kemPublic)
    }

    func publish(_ id: String, via transport: HubApprovalTransport, _ done: @escaping HubAccountSession.Status) {
        transport.send("/api/sync/v1/devices", body: body) { result in
            do {
                let receipt = try result.get()
                guard receipt["seq"]?.number == entry.seq, receipt["hash"]?.text == entry.hash
                else { throw HubAccountFailure.failed }
                transport.append(id, fields: ["entryHash": entry.hash], at: 3) { result in
                    done(result.map { _ in ["state": "approved"] })
                }
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }
}

extension SealedGrant {
    var enrollmentJson: SealedJson {
        .object(["account": .string(account), "scope": .string(scope), "epoch": .int(Int64(epoch)),
                 "device": .string(device), "enc": .string(enc), "ct": .string(ct)])
    }
}
