import Foundation

/// Kept before the first POST so a lost reply or process restart reopens the same mailbox.
private struct LoginEnrollmentNonce: Codable {
    let value: Data
    let issued: Date

    static let name = "enrollment-opening"

    static func current(_ store: HubLoginDeviceStore, now: Date) throws -> LoginEnrollmentNonce {
        if let data = store.load(name) {
            let kept = try JSONDecoder().decode(Self.self, from: data)
            let age = now.timeIntervalSince(kept.issued)
            guard kept.value.count == 32, (0..<600).contains(age) else { throw HubAccountFailure.expired }
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
    private(set) var mailbox: EnrollMailbox?

    func open(_ session: HubAccountSession, device: SealedDevice, _ done: @escaping Completion) {
        guard let credential = session.live(), let origin = session.origin else { return done(.failure(.signedOut)) }
        do {
            let store = try HubLoginDeviceStore(credential, base: session.loginKeys)
            let nonce = try LoginEnrollmentNonce.current(store, now: session.now())
            if mailbox != nil { return done(.success(())) }
            let request = try EnrollRequest(device: device, nonce: nonce.value)
            waiters.append(done)
            guard waiters.count == 1 else { return }
            var call = HubAccountCall(method: "POST", path: "/api/sync/v1/enroll",
                                      body: RemoteCoding.json(request.opening.fields))
            call.device = device.deviceId
            session.send(call, origin, credential.token) { result in
                let outcome = result.flatMap { self.accept($0, opening: request.opening) }
                let callbacks = self.waiters
                self.waiters.removeAll()
                callbacks.forEach { $0(outcome) }
            }
        } catch let failure as HubAccountFailure { done(.failure(failure)) }
        catch { done(.failure(.unkept)) }
    }

    private func accept(_ reply: HubAccountReply, opening: EnrollOpening) -> Result<Void, HubAccountFailure> {
        guard reply.status == 200 || reply.status == 201 else { return .failure(.hub(reply)) }
        do {
            let received = try EnrollMailbox(SealedJson.parse(reply.data))
            guard try received.opening() == opening else { return .failure(.failed) }
            mailbox = received
            return .success(())
        } catch { return .failure(.failed) }
    }

    func forget(_ store: HubLoginDeviceStore) { store.remove(LoginEnrollmentNonce.name) }
}
