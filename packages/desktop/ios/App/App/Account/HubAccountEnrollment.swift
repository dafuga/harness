import Foundation

enum HubEnrollmentPlatform: String { case iphone, mac }

/// Kept before the first POST so a lost reply or process restart reopens the same mailbox.
struct LoginEnrollmentNonce: Codable {
    let value: Data
    let issued: Date

    static let name = "enrollment-opening"

    static func current(_ store: HubLoginDeviceStore, now: Date) throws -> LoginEnrollmentNonce {
        if let data = store.load(name) {
            let kept = try JSONDecoder().decode(Self.self, from: data)
            let age = now.timeIntervalSince(kept.issued)
            guard kept.value.count == 32, (0..<600).contains(age) else { throw HubAccountFailure.approvalExpired }
            return kept
        }
        let fresh = Self(value: RemoteCoding.random(32), issued: now)
        try store.save(name, JSONEncoder().encode(fresh))
        return fresh
    }
}

/// Used on the account queue. Status polls share an in-flight request. Replies must identify
/// this phone's exact opening before the login can report that another device can approve it.
final class HubAccountEnrollment {
    typealias Completion = (Result<Void, HubAccountFailure>) -> Void
    private var waiters: [Completion] = []
    private(set) var verificationCode: String?
    private(set) var mailbox: EnrollMailbox?

    func open(_ session: HubAccountSession, device: SealedDevice, _ done: @escaping Completion) {
        guard let credential = session.live(), let origin = session.origin else { return done(.failure(.signedOut)) }
        do {
            let store = try HubLoginDeviceStore(credential, base: session.loginKeys)
            let nonce = try LoginEnrollmentNonce.current(store, now: session.now())
            let request = try EnrollRequest(device: device, nonce: nonce.value)
            waiters.append(done)
            guard waiters.count == 1 else { return }
            let prior = mailbox?.id
            let path = "/api/sync/v1/enroll" + (prior.map { "/" + $0 } ?? "")
            var fields = request.opening.fields
            fields["platform"] = session.enrollmentPlatform.rawValue
            var call = HubAccountCall(method: prior == nil ? "POST" : "GET", path: path,
                                      body: prior == nil ? RemoteCoding.json(fields) : nil)
            call.device = device.deviceId
            session.send(call, origin, credential.token) { result in
                do {
                    let received = try self.accept(result.get(), opening: request.opening, prior: prior)
                    self.mailbox = received
                    let comparison = HubLoginComparison(session: session, request: request, credential: credential, mailbox: received)
                    comparison.advance(self.finish)
                } catch { self.finish(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        } catch let failure as HubAccountFailure { done(.failure(failure)) }
        catch { done(.failure(.unkept)) }
    }

    private func accept(_ reply: HubAccountReply, opening: EnrollOpening, prior: String?) throws -> EnrollMailbox {
        if prior != nil, reply.status == 404 { throw HubAccountFailure.approvalExpired }
        guard reply.status == 200 || (prior == nil && reply.status == 201) else { throw HubAccountFailure.hub(reply) }
        let json = try SealedJson.parse(reply.data)
        let received = try EnrollMailbox(json)
        guard prior == nil || received.id == prior, try received.opening() == opening else { throw HubAccountFailure.failed }
        if case .bool(true) = json["denied"] { throw HubAccountFailure.approvalDenied }
        return received
    }

    private func finish(_ result: Result<String?, HubAccountFailure>) {
        verificationCode = try? result.get()
        let callbacks = waiters
        waiters.removeAll()
        callbacks.forEach { $0(result.map { _ in () }) }
    }

    func forget(_ store: HubLoginDeviceStore) {
        store.remove(LoginEnrollmentNonce.name)
        HubLoginComparison.forget(store)
    }
}
