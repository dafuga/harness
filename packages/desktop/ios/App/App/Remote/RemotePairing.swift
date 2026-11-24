import Foundation

/// The steps of one pairing attempt (backend-contract.md sections 5.1 and 8): ask the relay for
/// the pairing, send the sealed request, wait for the person at the computer, exchange. An
/// attempt that was cancelled answers nothing.
final class RemotePairing {
    struct Account {
        let hostKey: String
        let subject: String
        let request: ([String: Any], @escaping (Result<Void, RemoteFailure>) -> Void) -> Void
    }

    struct Input {
        let origin: String
        let hostId: String
        let pairingId: String
        let code: String
        let deviceName: String
        var account: Account? = nil
    }
    typealias Done = (Result<RemoteRecord, RemoteFailure>) -> Void

    private let input: Input
    private let queue: DispatchQueue
    private let relay = RemoteRelayClient()
    private var material = RemotePairingMaterial()
    private let started = Date()
    private var hostKey = ""
    private var cancelled = false

    init(_ input: Input, queue: DispatchQueue) {
        self.input = input
        self.queue = queue
    }

    private var path: String { "v1/hosts/\(input.hostId)/pairings/\(input.pairingId)" }

    func cancel() {
        cancelled = true
        relay.close()
    }

    /// `pending` is called once the request is with the computer and a person has to approve it.
    func start(pending: @escaping () -> Void, done finished: @escaping Done) {
        let done: Done = { [relay] result in
            relay.close()
            finished(result)
        }
        guard let origin = RemotePolicy.origin(input.origin) else {
            return done(.failure(.failed("The relay of this link is not an https address.")))
        }
        if let account = input.account {
            return ask(origin, ["hostKey": account.hostKey, "state": "open"], pending: pending, done: done)
        }
        relay.get(origin, path) { result in
            self.queue.async {
                guard !self.cancelled else { return }
                switch result {
                case .failure(let failure): done(.failure(failure))
                case .success(let info): self.ask(origin, info, pending: pending, done: done)
                }
            }
        }
    }

    private func ask(_ origin: URL, _ info: [String: Any], pending: @escaping () -> Void, done: @escaping Done) {
        guard let body = material.request(input, info: info) else {
            return done(.failure(.failed("This pairing is not open, or the relay named another computer.")))
        }
        hostKey = info["hostKey"] as? String ?? ""
        submit(origin, body) { result in
            self.queue.async {
                guard !self.cancelled else { return }
                if case .failure(let failure) = result { return done(.failure(failure)) }
                pending()
                self.poll(origin, done: done)
            }
        }
    }

    private func poll(_ origin: URL, done: @escaping Done) {
        queue.asyncAfter(deadline: .now() + RemoteLimits.pollSeconds) {
            guard !self.cancelled else { return }
            guard Date().timeIntervalSince(self.started) < RemoteLimits.pairingSeconds else {
                return done(.failure(.failed("The connection request expired.")))
            }
            self.relay.post(origin, "\(self.path)/poll", body: [:]) { result in
                self.queue.async { self.polled(origin, result, done: done) }
            }
        }
    }

    private func polled(_ origin: URL, _ result: Result<[String: Any], RemoteFailure>, done: @escaping Done) {
        guard !cancelled else { return }
        guard case .success(let answer) = result else { return poll(origin, done: done) }
        switch answer["state"] as? String {
        case "approved":
            relay.post(origin, "\(path)/exchange", body: ["verifier": material.verifier]) { result in
                self.queue.async { self.exchanged(result, done: done) }
            }
        case "denied": done(.failure(.failed("This computer refused the connection.")))
        case "expired": done(.failure(.failed("The connection request expired.")))
        default: poll(origin, done: done)
        }
    }

    /// The approval binds this exact device key: its identity is checked before anything is kept.
    private func exchanged(_ result: Result<[String: Any], RemoteFailure>, done: @escaping Done) {
        guard !cancelled else { return }
        switch result {
        case .failure(let failure): done(.failure(failure))
        case .success(let answer):
            guard let approval = material.approval(answer) else {
                return done(.failure(.failed("The approval did not match this phone. Nothing was kept.")))
            }
            done(.success(RemoteRecord(
                origin: input.origin, hostId: input.hostId, hostKey: hostKey, hostName: approval.hostName,
                deviceId: material.deviceId, deviceName: input.deviceName,
                deviceSecret: RemoteCoding.base64url(material.deviceKey.rawRepresentation),
                credential: approval.credential, generation: approval.generation, grant: approval.grant,
                lastOnlineAt: nil, epoch: nil, sequence: 0, methods: nil, accountSubject: input.account?.subject)))
        }
    }
}

extension RemotePairing {
    private func submit(_ origin: URL, _ body: [String: Any],
        done: @escaping (Result<Void, RemoteFailure>) -> Void
    ) {
        if let account = input.account { return account.request(body, done) }
        relay.post(origin, "\(path)/request", body: body) { done($0.map { _ in () }) }
    }
}
