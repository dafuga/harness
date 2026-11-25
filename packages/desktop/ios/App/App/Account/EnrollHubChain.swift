import Foundation

extension EnrollHub {
    func entries(as device: String) async throws -> [SealedChainEntry] {
        var entries: [SealedChainEntry] = []
        while entries.count <= 2048 {
            let reply = try await send(.chain(Int64(entries.count) - 1), as: device)
            let json = try response(reply, status: 200)
            guard let page = json["entries"]?.items else { throw HubAccountFailure.failed }
            entries += try page.map(SealedChainEntry.init(json:))
            if json["more"] == .bool(false), entries.count <= 2048 { return entries }
            if page.isEmpty { throw HubAccountFailure.failed }
        }
        throw HubAccountFailure.tooLarge
    }

    func grants(as device: String) async throws -> [SealedGrant] {
        let reply = try await send(.grants(device), as: device)
        let json = try response(reply, status: 200)
        guard let grants = json["grants"]?.items else { throw HubAccountFailure.failed }
        return try grants.map(SealedGrant.init(enrollmentJson:))
    }

    func publish(_ change: EnrollChange, as device: String) async throws -> SealedChainPin {
        guard let last = change.entries.last else { throw HubAccountFailure.refused }
        let data = SealedJson.object([
            "entries": .array(change.entries.map(\.json)),
            "grants": .array(change.grants.map(\.enrollmentJson))
        ])
        let reply = try await send(.changes, as: device, method: "POST", body: Data(data.canonical.utf8))
        let result = try response(reply, status: reply.status == 200 ? 200 : 201)
        guard result["seq"]?.number == last.seq, result["hash"]?.text == last.hash else {
            throw HubAccountFailure.failed
        }
        return SealedChainPin(seq: last.seq, head: last.hash)
    }

    func response(_ reply: HubAccountReply, status: Int) throws -> SealedJson {
        guard reply.status == status else {
            if reply.status == 409 {
                throw HubAccountFailure(code: "chain-conflict", message: "Devices changed. Refresh and try again.")
            }
            throw HubAccountFailure.hub(reply)
        }
        return try SealedJson.parse(reply.data)
    }
}

extension SealedGrant {
    var enrollmentJson: SealedJson {
        .object(["account": .string(account), "scope": .string(scope), "epoch": .int(Int64(epoch)),
                 "device": .string(device), "enc": .string(enc), "ct": .string(ct)])
    }

    init(enrollmentJson json: SealedJson) throws {
        guard let account = json["account"]?.text, let scope = json["scope"]?.text,
            let epoch = json["epoch"]?.number, let device = json["device"]?.text,
            let enc = json["enc"]?.text, let ct = json["ct"]?.text, let number = UInt32(exactly: epoch)
        else { throw HubAccountFailure.failed }
        self.init(account: account, scope: scope, epoch: number, device: device, enc: enc, ct: ct)
    }
}
