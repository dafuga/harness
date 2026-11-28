import Foundation

/// The secrets of one sign-in, made on this phone: a PKCE verifier with its S256 challenge, and
/// a nonce. The start sends the challenge and the nonce; only the exchange sends the verifier,
/// in a body. None of them is shown to the page or kept once the sign-in ends.
struct HubAccountProof {
    /// The audience the Hub issues every native session under, named after its first client.
    static let audience = "harness-desktop"
    static let resource = "projects"
    let verifier = RemoteCoding.base64url(RemoteCoding.random(32))
    let nonce = RemoteCoding.base64url(RemoteCoding.random(24))

    var challenge: String { RemoteCoding.base64url(RemoteCoding.sha256(Data(verifier.utf8))) }
    var start: [String: Any] { ["challenge": challenge, "nonce": nonce, "resource": Self.resource] }

    func exchange(_ handoffId: String, callbackCode: String?) -> [String: Any] {
        var value: [String: Any] = ["handoffId": handoffId, "verifier": verifier, "nonce": nonce, "resource": Self.resource]
        if let callbackCode = callbackCode { value["callbackCode"] = callbackCode }
        return value
    }
}

/// Times of the protocol: ISO 8601, with or without fractions of a second.
enum HubAccountDates {
    static func parse(_ value: Any?) -> Date? {
        guard let text = value as? String else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }
}

/// One sign-in as it waits for a system-browser return or typed-code recovery.
struct HubAccountHandoff {
    let handoffId: String
    let userCode: String
    let verificationUrl: String
    let expiry: String
    let expiresAt: Date
    let interval: Int
    let proof: HubAccountProof
    /// The account generation it was started under, and when the Hub may be asked again.
    var generation = 0
    var returning = false
    var next: Date

    /// The start answer as the protocol states it, or nil: an opaque id, the approval page of
    /// this very origin for it, a short code, 1 to 30 seconds between polls, an expiry soon.
    init?(_ answer: [String: Any], origin: URL, proof: HubAccountProof, now: Date) {
        let page = "\(origin.absoluteString)/native/"
        guard let id = answer["handoffId"] as? String, Self.opaque(id),
            let code = answer["userCode"] as? String, code.count <= 40,
            answer["verificationUrl"] as? String == page + id + (code.isEmpty ? "?return=1" : ""),
            let interval = answer["interval"] as? Int, (1...30).contains(interval),
            let expiry = answer["expiresAt"] as? String, let expiresAt = HubAccountDates.parse(expiry),
            expiresAt > now, expiresAt.timeIntervalSince(now) <= HubAccountLimits.handoffSeconds
        else { return nil }
        handoffId = id
        userCode = code
        verificationUrl = page + id + (code.isEmpty ? "?return=1" : "")
        self.expiry = expiry
        self.expiresAt = expiresAt
        self.interval = interval
        self.proof = proof
        next = now.addingTimeInterval(Double(interval))
    }

    var usesBrowserReturn: Bool { userCode.isEmpty }

    /// What the page shows: the code and the page to type it on. No verifier, nonce or session.
    var object: [String: Any] {
        ["userCode": userCode, "verificationUrl": verificationUrl, "expiresAt": expiry, "interval": interval]
    }

    /// The session the Hub issued, bound to what this sign-in asked for: the native audience,
    /// this nonce and resource, an expiry ahead, and a Google identity with a verified address.
    func credential(_ answer: [String: Any], origin: URL, now: Date) -> HubAccountCredential? {
        let actor = answer["actor"] as? [String: Any] ?? [:]
        guard answer["audience"] as? String == HubAccountProof.audience, answer["nonce"] as? String == proof.nonce,
            answer["resource"] as? String == HubAccountProof.resource,
            let token = answer["authorization"] as? String, Self.opaque(token),
            let expiresAt = HubAccountDates.parse(answer["expiresAt"]), expiresAt > now,
            let subject = actor["id"] as? String, !subject.isEmpty, actor["emailVerified"] as? Bool == true,
            let name = actor["name"] as? String, let email = actor["email"] as? String
        else { return nil }
        return HubAccountCredential(
            origin: origin.absoluteString, subject: subject, name: name, email: email, token: token,
            expiresAt: expiresAt)
    }

    /// The shape of a handoff id and of a session: what the Hub accepts as either.
    static func opaque(_ text: String) -> Bool {
        HubAccountPolicy.matches(text, "\\A[A-Za-z0-9_-]{32,128}\\z")
    }
}

/// Sign-in uses a scoped system-browser callback, with typed-code polling available for recovery.
extension HubAccountSession {
    func connect(_ done: @escaping Status) { begin(google: false, done) }

    func connectGoogle(_ done: @escaping Status) { begin(google: true, done) }

    private func begin(google: Bool, _ done: @escaping Status) {
        queue.async {
            guard let origin = self.origin else { return done(.failure(.notConfigured)) }
            if self.handoff.map({ $0.expiresAt <= self.now() }) == true { self.handoff = nil }
            if self.live() != nil || self.handoff != nil { return done(.success(self.snapshot)) }
            let proof = HubAccountProof()
            var input = proof.start
            if google {
                input["callback"] = "ios"
                input["deviceName"] = self.deviceName
            }
            let call = HubAccountCall(method: "POST", path: "/api/auth/native/start", body: RemoteCoding.json(input))
            self.send(call, origin, nil) { result in
                switch result {
                case .failure(let failure): done(.failure(failure))
                case .success(let reply): done(self.started(reply, origin, proof, google))
                }
            }
        }
    }

    private func started(
        _ reply: HubAccountReply, _ origin: URL, _ proof: HubAccountProof, _ google: Bool
    ) -> Result<[String: Any], HubAccountFailure> {
        guard credential == nil, self.handoff == nil else { return .success(snapshot) }
        guard reply.status == 200, let answer = RemoteCoding.object(reply.data),
            var waiting = HubAccountHandoff(answer, origin: origin, proof: proof, now: now()), waiting.usesBrowserReturn == google,
            let page = URL(string: waiting.verificationUrl)
        else { return .failure(reply.status == 200 ? .failed : .hub(reply)) }
        waiting.generation = generation
        self.handoff = waiting
        if google { self.authenticate(page, waiting.handoffId) }
        else { self.open(page) }
        return .success(snapshot)
    }

    /// Asks whether the code was approved: never before the interval, never after the expiry.
    func poll(_ handoff: HubAccountHandoff, _ origin: URL, _ done: @escaping Status) {
        let time = now()
        guard handoff.expiresAt > time, handoff.generation == generation else {
            erase()
            return done(.success(snapshot))
        }
        guard !handoff.usesBrowserReturn, handoff.next <= time else { return done(.success(snapshot)) }
        self.handoff?.next = time.addingTimeInterval(Double(handoff.interval))
        let body = RemoteCoding.json(["handoffId": handoff.handoffId])
        send(HubAccountCall(method: "POST", path: "/api/auth/native/poll", body: body), origin, nil) { result in
            guard self.handoff?.handoffId == handoff.handoffId else { return done(.success(self.snapshot)) }
            switch result {
            case .failure(let failure): done(.failure(failure))
            case .success(let reply): self.polled(reply, handoff, origin, done)
            }
        }
    }

    /// A failed poll leaves the sign-in waiting; an expired or refused one ends it.
    private func polled(_ reply: HubAccountReply, _ handoff: HubAccountHandoff, _ origin: URL, _ done: @escaping Status) {
        guard reply.status == 200, let state = RemoteCoding.object(reply.data)?["status"] as? String else {
            return done(.failure(.failed))
        }
        if state == "pending" { return done(.success(snapshot)) }
        self.handoff = nil
        guard state == "approved" else { return done(.failure(.expired)) }
        exchange(handoff, origin, done)
    }

    /// The one exchange of an approved code: the verifier proves this phone asked for it. A
    /// session is kept only when it is bound to this sign-in; any other one issued is ended.
    func exchange(
        _ handoff: HubAccountHandoff, _ origin: URL, callbackCode: String? = nil, _ done: @escaping Status
    ) {
        let body = RemoteCoding.json(handoff.proof.exchange(handoff.handoffId, callbackCode: callbackCode))
        let call = HubAccountCall(method: "POST", path: "/api/auth/native/exchange", body: body)
        guard let request = HubAccountPolicy.request(origin, call, token: nil) else { return done(.failure(.refused)) }
        let asked = generation
        transport.send(request) { result in
            self.queue.async {
                let reply = try? result.get()
                let answer = reply.flatMap { $0.status == 200 ? RemoteCoding.object($0.data) : nil } ?? [:]
                let issued = handoff.credential(answer, origin: origin, now: self.now())
                guard asked == self.generation, let credential = issued else {
                    self.discard(answer, origin)
                    return done(asked == self.generation ? .failure(.expired) : .success(self.snapshot))
                }
                self.keep(credential, origin, done)
            }
        }
    }

    /// A session issued to a sign-in this phone no longer waits for, or bound to another, is ended.
    private func discard(_ answer: [String: Any], _ origin: URL) {
        guard let token = answer["authorization"] as? String, HubAccountHandoff.opaque(token) else { return }
        revoke(token, origin)
    }

    /// The session is in the Keychain before it is used, and used once the Hub confirms its person.
    private func keep(_ credential: HubAccountCredential, _ origin: URL, _ done: @escaping Status) {
        do {
            try vault.save(credential)
        } catch {
            revoke(credential.token, origin)
            return done(.failure(.unkept))
        }
        guard let kept = vault.load(), kept.origin == credential.origin, kept.subject == credential.subject,
            kept.token == credential.token else {
            revoke(credential.token, origin)
            return done(.failure(.unkept))
        }
        self.credential = kept
        generation += 1
        confirm(origin, done)
    }
}
