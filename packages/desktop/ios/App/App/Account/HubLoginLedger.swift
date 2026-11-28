import Foundation

/// Reads sealed login records only within the current native account generation.
struct HubLoginLedger {
    let session: HubAccountSession
    let credential: HubAccountCredential
    let device: SealedDevice

    func readChain(_ previous: [SealedChainEntry],
                           _ done: @escaping (Result<[SealedChainEntry], HubAccountFailure>) -> Void) throws {
        let call = HubAccountCall(method: "GET", path: "/api/sync/v1/chain", query: ["after": String(previous.count - 1)])
        try send(call) { result in
            do {
                let reply = try result.get()
                guard reply.status == 200 else { return done(.failure(.hub(reply))) }
                let json = try SealedJson.parse(reply.data)
                guard let page = json["entries"]?.items, page.count <= 2048 - previous.count,
                    case .bool(let more) = json["more"] else { return done(.failure(.failed)) }
                let entries = previous + (try page.map(SealedChainEntry.init(json:)))
                guard more else { return done(.success(entries)) }
                guard !page.isEmpty, entries.count < 2048 else { return done(.failure(.tooLarge)) }
                try readChain(entries, done)
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    func send(_ call: HubAccountCall, _ done: @escaping HubAccountSession.Answer) throws {
        guard let origin = session.origin, session.live() == credential else { throw HubAccountFailure.superseded }
        var bound = call
        bound.device = device.deviceId
        session.send(bound, origin, credential.token, done)
    }

    func grants(_ done: @escaping (Result<[SealedGrant], HubAccountFailure>) -> Void) throws {
        let call = HubAccountCall(method: "GET", path: "/api/sync/v1/grants", query: ["device": device.deviceId])
        try send(call) { result in
            do {
                let reply = try result.get()
                guard reply.status == 200 else { throw HubAccountFailure.hub(reply) }
                guard let grants = try SealedJson.parse(reply.data)["grants"]?.items else { throw HubAccountFailure.failed }
                done(.success(try grants.map(SealedGrant.init(enrollmentJson:))))
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }
}

extension SealedGrant {
    init(enrollmentJson json: SealedJson) throws {
        guard let account = json["account"]?.text, let scope = json["scope"]?.text,
            let epoch = json["epoch"]?.number, let device = json["device"]?.text,
            let enc = json["enc"]?.text, let ct = json["ct"]?.text, let number = UInt32(exactly: epoch)
        else { throw HubAccountFailure.failed }
        self.init(account: account, scope: scope, epoch: number, device: device, enc: enc, ct: ct)
    }
}
