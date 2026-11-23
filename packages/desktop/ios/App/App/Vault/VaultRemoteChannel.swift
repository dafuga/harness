import Foundation

struct VaultRemoteChannel {
    struct Authority: Equatable {
        let scope: String
        let epoch: String
    }

    let session: RemoteSession
    let authority: Authority

    func required<Value: Decodable>(
        _ method: String, input: [String: Any] = [:], as type: Value.Type
    ) async throws -> Value {
        let value = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Any, Error>) in
            session.vaultCall(method, input: input, authority: authority) { result in
                continuation.resume(with: result.mapError { $0 as Error })
            }
        }
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { throw RemoteFailure.invalid }
        return try JSONDecoder().decode(type, from: data)
    }
}

extension RemoteSession {
    func openVaultChannel() async throws -> VaultRemoteChannel {
        try await withCheckedThrowingContinuation { continuation in
            captureVaultChannel { continuation.resume(with: $0.mapError { $0 as Error }) }
        }
    }

    private func captureVaultChannel(_ done: @escaping (Result<VaultRemoteChannel, RemoteFailure>) -> Void) {
        queue.async {
            guard let authority = self.vaultAuthority, self.state == "online",
                self.record?.methods?.contains("vaultInfo") == true
            else { return done(.failure(.denied)) }
            done(.success(VaultRemoteChannel(session: self, authority: authority)))
        }
    }

    func vaultCall(
        _ method: String, input: [String: Any], authority: VaultRemoteChannel.Authority,
        done: @escaping RemoteRequests.Done
    ) {
        queue.async {
            guard self.vaultAuthority == authority, RemoteMethods.vault.contains(method),
                self.record?.methods?.contains(method) == true else { return done(.failure(.denied)) }
            guard self.state == "online", let link = self.link else { return done(.failure(.offline)) }
            var body = input
            body["epoch"] = authority.epoch
            switch self.requests.add(method: method, input: body, done: done) {
            case .failure(let failure): done(.failure(failure))
            case .success(let message): if !link.send(message) { self.lose(nil) }
            }
        }
    }

    private var vaultAuthority: VaultRemoteChannel.Authority? {
        guard let scope = scope, let epoch = record?.epoch else { return nil }
        return VaultRemoteChannel.Authority(scope: scope, epoch: epoch)
    }
}
