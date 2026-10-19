import Foundation

/// This phone's own session at the Harness Hub (hub-authentication.md). A person signs in with
/// Google in the browser and approves this phone by the code it shows; the phone keeps the
/// session it is issued. The origin, the verifier, the nonce and the session stay on this side:
/// the page is told a public status and the answers of project reads. Signing in is in
/// HubAccountHandoff.swift. Every state change happens on `queue`, one at a time.
final class HubAccountSession {
    typealias Status = (Result<[String: Any], HubAccountFailure>) -> Void
    typealias Answer = (Result<HubAccountReply, HubAccountFailure>) -> Void

    let queue = DispatchQueue(label: "com.dafuga.harness.hub")
    let origin: URL?
    let vault: HubAccountVault
    let transport: HubAccountTransport
    /// Opens an address in the system browser; the plugin hands in the one of iOS.
    var open: (URL) -> Void = { _ in }
    var now: () -> Date = { Date() }
    var credential: HubAccountCredential?
    var handoff: HubAccountHandoff?
    /// Counts every change of account: an answer to a call made before one is never used.
    var generation = 0
    private var loaded = false

    init(origin: URL?, vault: HubAccountVault = HubAccountKeychain(), transport: HubAccountTransport = HubAccountHttp()) {
        self.origin = origin
        self.vault = vault
        self.transport = transport
    }

    /// `NativeHostedStatus`: whether this build names a Hub, the state, the person, and while a
    /// sign-in waits the code to type. A kept session is confirmed by the Hub each time.
    func status(_ done: @escaping Status) {
        queue.async {
            guard let origin = self.origin else { return done(.success(self.snapshot)) }
            if let handoff = self.handoff { return self.poll(handoff, origin, done) }
            if self.live() != nil { return self.confirm(origin, done) }
            self.publicStatus(origin, done)
        }
    }

    /// Forgets the session before anything else, then asks the Hub to end it. A sign-in under
    /// way ends with it, and whatever was asked before answers nobody.
    func disconnect(_ done: @escaping Status) {
        queue.async {
            let ended = self.live()
            self.erase()
            if let ended = ended, let origin = self.origin { self.revoke(ended.token, origin) }
            done(.success(self.snapshot))
        }
    }

    /// One project call of the page, signed here. Only the project API of this build's Hub is
    /// asked. A 401 ends the session on this phone too, and the page hears it as an answer.
    func request(_ call: HubAccountCall, _ done: @escaping Answer) {
        queue.async {
            guard let origin = self.origin else { return done(.failure(.notConfigured)) }
            guard HubAccountPolicy.allowed(call) else { return done(.failure(.refused)) }
            guard let credential = self.live() else { return done(.failure(.signedOut)) }
            self.send(call, origin, credential.token) { result in
                if case .success(let reply) = result, reply.status == 401 { self.erase() }
                done(result)
            }
        }
    }

    /// The public status. It never holds the session, the verifier or the nonce.
    var snapshot: [String: Any] {
        var status: [String: Any] = ["configured": origin != nil, "state": "signed-out"]
        if let handoff = handoff {
            status["state"] = "pending"
            status["handoff"] = handoff.object
        } else if let credential = credential {
            status["state"] = "signed-in"
            status["actor"] = ["id": credential.subject, "name": credential.name, "email": credential.email]
        }
        return status
    }

    /// The kept session while its expiry is ahead and it belongs to this build's Hub. Any other
    /// is erased, and never sent anywhere.
    func live() -> HubAccountCredential? {
        if !loaded {
            loaded = true
            credential = vault.load()
        }
        guard let kept = credential else { return nil }
        if kept.expiresAt > now(), kept.origin == origin?.absoluteString { return kept }
        erase()
        return nil
    }

    /// The session leaves the Keychain and memory, a sign-in under way ends, and every answer
    /// still awaited is refused when it arrives.
    func erase() {
        vault.wipe()
        credential = nil
        handoff = nil
        generation += 1
    }

    /// Asks the Hub to end a session this phone no longer keeps. Its answer changes nothing here.
    func revoke(_ token: String, _ origin: URL) {
        let call = HubAccountCall(method: "POST", path: "/api/auth/logout", body: Data("{}".utf8))
        guard let request = HubAccountPolicy.request(origin, call, token: token) else { return }
        transport.send(request) { _ in }
    }

    /// Sends one call and answers on the queue, only while the account it was made under holds.
    func send(_ call: HubAccountCall, _ origin: URL, _ token: String?, _ done: @escaping Answer) {
        guard let request = HubAccountPolicy.request(origin, call, token: token) else {
            return done(.failure(.refused))
        }
        let asked = generation
        transport.send(request) { result in
            self.queue.async { done(asked == self.generation ? result : .failure(.superseded)) }
        }
    }
}

/// What the Hub says of a kept session, asked each time the page asks for the status.
extension HubAccountSession {
    static let statusCall = HubAccountCall(method: "GET", path: "/api/auth/status")

    /// A kept session holds only while the Hub names the same verified person for it. One the
    /// Hub no longer knows is erased; one it names another person for is erased and ended.
    func confirm(_ origin: URL, _ done: @escaping Status) {
        guard let kept = live() else { return done(.success(snapshot)) }
        send(Self.statusCall, origin, kept.token) { result in
            switch result {
            case .failure(let failure): done(failure == .superseded ? .success(self.snapshot) : .failure(failure))
            case .success(let reply): done(self.confirmed(reply, kept, origin))
            }
        }
    }

    private func confirmed(
        _ reply: HubAccountReply, _ kept: HubAccountCredential, _ origin: URL
    ) -> Result<[String: Any], HubAccountFailure> {
        if reply.status == 401 {
            erase()
            return .success(snapshot)
        }
        guard reply.status == 200, let answer = RemoteCoding.object(reply.data) else { return .failure(.failed) }
        guard let actor = answer["actor"] as? [String: Any] else {
            erase()
            return .success(snapshot)
        }
        guard actor["id"] as? String == kept.subject, actor["emailVerified"] as? Bool == true else {
            erase()
            revoke(kept.token, origin)
            return .failure(.mismatch)
        }
        return .success(snapshot)
    }

    /// Without a session the Hub says whether sign-in is set up there; unreached, the build does.
    func publicStatus(_ origin: URL, _ done: @escaping Status) {
        send(Self.statusCall, origin, nil) { result in
            var status = self.snapshot
            if case .success(let reply) = result, reply.status == 200, self.credential == nil,
                self.handoff == nil, let answer = RemoteCoding.object(reply.data) {
                status["configured"] = answer["configured"] as? Bool == true
            }
            done(.success(status))
        }
    }
}
