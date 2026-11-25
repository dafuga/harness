import Foundation

struct TrackerSealedHub {
    let identity: TrackerSealedIdentity
    let device: String
    let transport: HubAccountTransport

    func request(_ path: String, query: [String: String] = [:]) throws -> URLRequest {
        let call = HubAccountCall(method: "GET", path: "/api/sync/v1/" + path, query: query)
        guard var request = HubAccountPolicy.request(identity.origin, call, token: identity.bearer) else {
            throw HubAccountFailure.refused
        }
        request.setValue(device, forHTTPHeaderField: "X-Harness-Device")
        return request
    }

    func get(_ path: String, query: [String: String] = [:]) async throws -> Data {
        let request = try request(path, query: query)
        let reply: HubAccountReply = try await withCheckedThrowingContinuation { continuation in
            transport.send(request) { continuation.resume(with: $0) }
        }
        try Task.checkCancellation()
        if reply.status == 401 { throw HubAccountFailure.signedOut }
        guard reply.status == 200 else { throw HubAccountFailure.hub(reply) }
        return reply.data
    }

    func chain() async throws -> [SealedChainEntry] {
        var entries: [SealedChainEntry] = []
        while entries.count <= 2048 {
            let data = try await get("chain", query: ["after": String(entries.count - 1)])
            let json = try SealedJson.parse(data)
            guard let page = json["entries"]?.items, page.count <= 200 else { break }
            entries += try page.map(SealedChainEntry.init(json:))
            if json["more"] == .bool(false), entries.count <= 2048 { return entries }
            if page.isEmpty { break }
        }
        throw TrackerReplicaError.invalidPage
    }

    func grants() async throws -> [SealedGrant] {
        let data = try await get("grants", query: ["device": device])
        guard let grants = try SealedJson.parse(data)["grants"]?.items, grants.count <= 500 else {
            throw TrackerReplicaError.invalidPage
        }
        return try grants.map { json in
            guard let account = json["account"]?.text, let scope = json["scope"]?.text,
                let device = json["device"]?.text, let epoch = json["epoch"]?.number.flatMap(UInt32.init(exactly:)),
                let enc = json["enc"]?.text, let ct = json["ct"]?.text else { throw TrackerReplicaError.invalidPage }
            return SealedGrant(account: account, scope: scope, epoch: epoch, device: device, enc: enc, ct: ct)
        }
    }

    func openSocket(_ delegate: RemoteSocketDelegate) throws -> (URLSession, URLSessionWebSocketTask) {
        let request = try request("live")
        guard let address = request.url, var parts = URLComponents(url: address, resolvingAgainstBaseURL: false)
        else { throw HubAccountFailure.refused }
        parts.scheme = "wss"
        var upgrade = request
        upgrade.url = parts.url
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.urlCredentialStorage = nil
        let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
        let socket = session.webSocketTask(with: upgrade)
        socket.maximumMessageSize = 256 * 1024 + 8
        return (session, socket)
    }
}
