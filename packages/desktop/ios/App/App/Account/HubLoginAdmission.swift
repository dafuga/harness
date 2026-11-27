import Foundation

/// The Hub session and the sealed chain must agree. Keep only the verified chain head on disk.
/// Scope keys remain in the account session and are reopened from HPKE grants after a restart.
struct HubLoginAdmission {
    static let pinName = "verified-ledger-head"
    let ledger: HubLoginLedger
    let store: HubLoginDeviceStore

    @available(iOS 17.0, macOS 14.0, *)
    func verify(pin: SealedChainPin?, _ done: @escaping (Result<EnrolledDevice, HubAccountFailure>) -> Void) throws {
        try ledger.readChain([]) { result in
            do {
                let entries = try result.get()
                let state = try SealedChain.verify(entries, account: ledger.credential.subject, pin: pin)
                let receipt = try approval(entries)
                try ledger.grants { result in
                    do {
                        let grants = try result.get()
                        if let (request, proof) = receipt {
                            done(.success(try request.accept(entries: entries, grants: grants, approval: proof)))
                        } else {
                            done(.success(try EnrolledDevice.open(state, grants: grants, as: ledger.device)))
                        }
                    } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
                }
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    private func approval(_ entries: [SealedChainEntry]) throws -> (EnrollRequest, EnrollReceipt)? {
        let device = ledger.device
        if entries.first?.by == device.deviceId && store.load(LoginClaimPin.name) == nil &&
            store.load(LoginEnrollmentNonce.name) == nil { return nil }
        guard let claimData = store.load(LoginClaimPin.name), let openingData = store.load(LoginEnrollmentNonce.name)
        else { throw HubAccountFailure.refused }
        let claim = try JSONDecoder().decode(LoginClaimPin.self, from: claimData)
        let opening = try JSONDecoder().decode(LoginEnrollmentNonce.self, from: openingData)
        guard claim.sequence >= 0, claim.sequence < Int64(entries.count),
            entries[Int(claim.sequence)].hash == claim.head,
            let entry = entries.first(where: {
                $0.seq > claim.sequence && $0.by == claim.approver && $0.body["type"]?.text == "enroll" &&
                    $0.body["device"]?["deviceId"]?.text == device.deviceId
            })
        else { throw HubAccountFailure.refused }
        let receipt = EnrollReceipt(account: ledger.credential.subject,
                                    claim: EnrollClaim(approver: claim.approver, nonce: claim.nonce),
                                    approverSigningPublic: claim.signingKey, entryHash: entry.hash)
        return (try EnrollRequest(device: device, nonce: opening.value), receipt)
    }
}

extension HubAccountSession {
    func verifyAdmission(_ device: SealedDevice, _ done: @escaping Status) {
        deviceStage = .checking
        enrolledDevice = nil
        guard #available(iOS 17.0, macOS 14.0, *), let credential = live() else { return done(.failure(.refused)) }
        let attempt = deviceCheck
        do {
            let ledger = HubLoginLedger(session: self, credential: credential, device: device)
            let keys = try HubLoginDeviceStore(credential, base: loginKeys)
            let pins = try HubLoginDeviceStore(credential, base: loginPins)
            let pin = try pins.load(HubLoginAdmission.pinName).map { try JSONDecoder().decode(SealedChainPin.self, from: $0) }
            try HubLoginAdmission(ledger: ledger, store: keys).verify(pin: pin) { result in
                guard self.deviceCheck == attempt, self.live() == credential else { return done(.failure(.superseded)) }
                do {
                    let accepted = try result.get()
                    if accepted.pin != pin { try pins.save(HubLoginAdmission.pinName, JSONEncoder().encode(accepted.pin)) }
                    self.enrolledDevice = accepted
                    self.deviceStage = .approved
                    done(.success(self.snapshot))
                } catch { done(.failure(error as? HubAccountFailure ?? .unkept)) }
            }
        } catch { done(.failure(error as? HubAccountFailure ?? .unkept)) }
    }
}
