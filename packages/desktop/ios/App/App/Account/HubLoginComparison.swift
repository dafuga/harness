import Foundation

/// Written before the nonce is revealed. A revised mailbox must still name exactly this
/// claim and signing key, and its verified device chain must include the original head.
struct LoginClaimPin: Codable {
    static let name = "enrollment-claim"
    let mailbox: String
    let approver: String
    let nonce: Data
    let signingKey: Data
    let sequence: Int64
    let head: String

    var chain: SealedChainPin { SealedChainPin(seq: sequence, head: head) }
}

/// A queue-bound exchange on the currently authenticated native transport.
struct HubLoginComparison {
    typealias Completion = (Result<String?, HubAccountFailure>) -> Void
    let session: HubAccountSession
    let request: EnrollRequest
    let credential: HubAccountCredential
    let mailbox: EnrollMailbox

    private var ledger: HubLoginLedger { HubLoginLedger(session: session, credential: credential, device: request.device) }

    func advance(_ done: @escaping Completion) {
        do {
            let store = try HubLoginDeviceStore(credential, base: session.loginKeys)
            let pin = try store.load(LoginClaimPin.name).map { try JSONDecoder().decode(LoginClaimPin.self, from: $0) }
            guard let claim = try mailbox.claim() else {
                return done(pin == nil ? .success(nil) : .failure(.failed))
            }
            if let pin, pin.mailbox != mailbox.id || pin.approver != claim.approver || pin.nonce != claim.nonce {
                return done(.failure(.failed))
            }
            let saved = try HubLoginDeviceStore(credential, base: session.loginPins)
            let accountPin = try saved.load(HubLoginAdmission.pinName)
                .map { try JSONDecoder().decode(SealedChainPin.self, from: $0) }
            try ledger.readChain([]) { result in
                do {
                    let state = try SealedChain.verify(result.get(), account: credential.subject,
                                                       pin: pin?.chain ?? accountPin)
                    guard let admin = state.devices[claim.approver], admin.active, admin.role == "admin",
                        let key = RemoteCoding.data(base64url: admin.signingPublic),
                        pin == nil || pin?.signingKey == key else { return done(.failure(.failed)) }
                    let code = try request.code(claim: claim, approverSigningPublic: key)
                    if pin == nil {
                        guard try mailbox.reveal() == nil else { return done(.failure(.failed)) }
                        let lock = LoginClaimPin(mailbox: mailbox.id, approver: claim.approver, nonce: claim.nonce,
                                                 signingKey: key, sequence: state.seq, head: state.head)
                        try store.save(LoginClaimPin.name, JSONEncoder().encode(lock))
                    }
                    try reveal(code, done)
                } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
    }

    private func reveal(_ code: String, _ done: @escaping Completion) throws {
        if let shown = try mailbox.reveal() {
            return done(shown == request.nonce ? .success(code) : .failure(.failed))
        }
        let body = RemoteCoding.json(["nonce": RemoteCoding.base64url(request.nonce)])
        let call = HubAccountCall(method: "POST", path: "/api/sync/v1/enroll/" + mailbox.id, body: body)
        try ledger.send(call) { result in
            do {
                let reply = try result.get()
                guard [200, 201].contains(reply.status) else { return done(.failure(.hub(reply))) }
                let step = try EnrollMailbox.Step(SealedJson.parse(reply.data), position: 2)
                guard step.by == request.device.deviceId, try step.bytes("nonce") == request.nonce
                else { return done(.failure(.failed)) }
                done(.success(code))
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    static func forget(_ store: HubLoginDeviceStore) { store.remove(LoginClaimPin.name) }
}
