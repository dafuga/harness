import Foundation

/// Account discovery and pairing use the Hub chosen at build time. Only display fields leave
/// native code. The public project bridge cannot call either remote-computer endpoint.
extension HubAccountSession {
    private static let hostsPath = "/api/remote/hosts"
    private static let hostPattern = "\\A[a-f0-9]{40}\\z"

    func computers(_ done: @escaping (Result<[[String: Any]], HubAccountFailure>) -> Void) {
        queue.async {
            self.computerCall(HubAccountCall(method: "GET", path: Self.hostsPath, query: ["linked": "1"])) { result in
                done(result.flatMap(Self.computerList))
            }
        }
    }

    func computerPairing(_ hostId: String, name: String,
        done: @escaping (Result<RemotePairing.Input, HubAccountFailure>) -> Void
    ) {
        guard HubAccountPolicy.matches(hostId, Self.hostPattern) else { return done(.failure(.refused)) }
        let path = "\(Self.hostsPath)/\(hostId)/pairing"
        queue.async {
            self.computerCall(HubAccountCall(method: "GET", path: path)) { result in
                done(result.flatMap { self.pairingInput($0, hostId: hostId, name: name, path: path) })
            }
        }
    }

    private static func computerList(_ reply: HubAccountReply) -> Result<[[String: Any]], HubAccountFailure> {
        if [404, 405].contains(reply.status) { return .success([]) }
        guard reply.status == 200,
            let list = RemoteCoding.object(reply.data)?["computers"] as? [[String: Any]]
        else { return .failure(.failed) }
        return .success(list.compactMap { computer in
            guard let hostId = computer["hostId"] as? String, HubAccountPolicy.matches(hostId, hostPattern),
                let name = computer["name"] as? String, let online = computer["online"] as? Bool
            else { return nil }
            return ["hostId": hostId, "name": name, "online": online]
        })
    }

    private func pairingInput(_ reply: HubAccountReply, hostId: String, name: String, path: String)
        -> Result<RemotePairing.Input, HubAccountFailure>
    {
        guard reply.status == 200, let info = RemoteCoding.object(reply.data),
            info["hostId"] as? String == hostId, let key = info["hostKey"] as? String,
            let origin = info["origin"] as? String, RemotePolicy.origin(origin) != nil,
            let subject = live()?.subject
        else { return .failure(.failed) }
        let pairingId = RemoteCoding.hex(RemoteCoding.random(16))
        let generation = self.generation
        let account = RemotePairing.Account(hostKey: key, subject: subject) { body, done in
            self.queue.async {
                guard generation == self.generation else { return done(.failure(.failed("Sign in to continue."))) }
                let data = RemoteCoding.json(body.merging(["pairingId": pairingId]) { value, _ in value })
                self.postPairing(path, data: data, done: done)
            }
        }
        return .success(RemotePairing.Input(origin: origin, hostId: hostId, pairingId: pairingId,
            code: "", deviceName: name, account: account))
    }

    private func postPairing(_ path: String, data: Data?, done: @escaping (Result<Void, RemoteFailure>) -> Void) {
        guard let data = data else { return done(.failure(.invalid)) }
        computerCall(HubAccountCall(method: "POST", path: path, body: data)) { result in
            guard case .success(let reply) = result, reply.status == 202,
                RemoteCoding.object(reply.data)?["state"] as? String == "requested"
            else { return done(.failure(.failed("Could not ask this computer. Try again."))) }
            done(.success(()))
        }
    }

    private func computerCall(_ call: HubAccountCall, _ done: @escaping Answer) {
        guard let origin = origin else { return done(.failure(.notConfigured)) }
        authorizedCall(call, origin) { result in
            if case .success(let reply) = result, reply.status == 401 {
                return done(.failure(.signedOut))
            }
            done(result)
        }
    }
}
