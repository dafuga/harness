import Foundation

/// Queue-bound comparison state. Once opened, each step must match the original transcript.
final class HubLoginReview {
    typealias Authentication = (@escaping (Bool) -> Void) -> Void

    let id: String
    let expires: Date
    private var opening: EnrollOpening?
    private var claim: EnrollClaim?
    private var reveal: Data?
    private var code: String?
    private var publication: HubApprovalPublication?
    private var busy = false

    init(id: String, now: Date) {
        self.id = id
        expires = now + 600
    }

    func review(_ transport: HubApprovalTransport, _ done: @escaping HubAccountSession.Status) {
        guard !busy else { return done(.failure(.refused)) }
        busy = true
        transport.mailbox(id) { result in
            let finish: HubAccountSession.Status = { self.busy = false; done($0) }
            do { try self.compare(result.get(), via: transport, finish) }
            catch { finish(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    private func compare(_ mailbox: EnrollMailbox, via transport: HubApprovalTransport,
                         _ done: @escaping HubAccountSession.Status) throws {
        let received = try mailbox.opening()
        let device = transport.ledger.device
        guard received.deviceId != device.deviceId, opening == nil || received == opening
        else { return done(.failure(.refused)) }
        _ = try received.chainDevice(scopes: [])
        let current = try mailbox.claim()
        opening = received
        if claim == nil {
            guard current == nil else { return done(.failure(.refused)) }
            claim = EnrollClaim(approver: device.deviceId, nonce: RemoteCoding.random(32))
        }
        guard let claim, current == nil || claim == current else { return done(.failure(.refused)) }
        if current == nil {
            transport.append(id, fields: ["approver": claim.approver, "nonce": RemoteCoding.base64url(claim.nonce)], at: 1) { result in
                done(result.map { _ in ["state": "waiting"] })
            }
            return
        }
        guard let nonce = try mailbox.reveal() else { return done(.success(["state": "waiting"])) }
        guard reveal == nil || reveal == nonce,
            SealedEnroll.checkCommit(received.keys, nonce: nonce, commitment: received.commit)
        else { return done(.failure(.refused)) }
        reveal = nonce
        let matching = try SealedEnroll.code(request: received.keys, requestNonce: nonce,
                                             approverSigningPublic: device.signingPublic, approverNonce: claim.nonce)
        code = matching
        done(.success(["state": "compare", "code": matching]))
    }

    @available(iOS 17.0, macOS 14.0, *)
    func approve(code expected: String, via transport: HubApprovalTransport,
                 authenticate: Authentication, _ done: @escaping HubAccountSession.Status) {
        guard !busy, let opening, code == expected, reveal != nil else { return done(.failure(.refused)) }
        busy = true
        let finish: HubAccountSession.Status = { self.busy = false; done($0) }
        if let publication { return publication.publish(id, via: transport, finish) }

        let session = transport.ledger.session
        let generation = session.generation
        authenticate { accepted in
            session.queue.async {
                guard accepted, generation == session.generation, session.deviceStage == .approved,
                    session.live() == transport.ledger.credential
                else { return finish(.failure(.refused)) }
                self.prepare(opening, via: transport, finish)
            }
        }
    }

    @available(iOS 17.0, macOS 14.0, *)
    private func prepare(_ opening: EnrollOpening, via transport: HubApprovalTransport,
                         _ done: @escaping HubAccountSession.Status) {
        do {
            try transport.ledger.readChain([]) { result in
                do {
                    let chain = try SealedChain.verify(result.get(), account: transport.ledger.credential.subject,
                                                       pin: transport.admitted.pin)
                    let publication = try HubApprovalPublication(id: self.id, opening: opening, chain: chain, via: transport)
                    self.publication = publication
                    publication.publish(self.id, via: transport, done)
                } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
    }
}
