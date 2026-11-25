import Foundation

@available(iOS 17.0, macOS 14.0, *)
func checkEnrollmentWorkflow() async {
    do {
        var fixture = ChainFixture.genesis()
        let state = try SealedChain.verify(fixture.entries, account: "acct")
        let keys = try SealedScopeKeys(fixture.account)
        let request = try EnrollRequest(device: fixture.phone, nonce: Data(repeating: 3, count: 32))
        let claim = EnrollClaim(approver: fixture.admin.deviceId, nonce: Data(repeating: 7, count: 32))
        let review = try EnrollApproval(
            opening: request.opening, claim: claim, reveal: request.nonce, approver: fixture.admin)
        let code = try request.code(claim: claim, approverSigningPublic: fixture.admin.signingPublic)
        check(review.code == code && code.count == 6, "request and review show the same six digits")
        refuses("approval refuses a reveal that does not open the commitment") {
            _ = try EnrollApproval(
                opening: request.opening, claim: claim, reveal: claim.nonce, approver: fixture.admin)
        }
        let change = try await review.authorize(
            with: EnrollAdmin(device: fixture.admin, state: state, keys: [keys.name: keys]),
            at: 2, authenticate: { false })
        check(change == nil, "biometric denial produces no signed enrollment or grants")
        guard let approved = try await review.authorize(
            with: EnrollAdmin(device: fixture.admin, state: state, keys: [keys.name: keys]),
            at: 2, authenticate: { true }) else { throw SealedError("Synthetic approval failed.") }
        fixture.entries += approved.entries
        let receipt = EnrollReceipt(account: "acct", claim: claim,
            approverSigningPublic: fixture.admin.signingPublic, entryHash: approved.entries[0].hash)
        let accepted = try request.accept(entries: fixture.entries, grants: approved.grants, approval: receipt)
        checkGrantAndSignerRefusals(request, fixture, approved, receipt)
        check(accepted.pin.seq == 1 && accepted.keys[keys.name]?.commitment == keys.commitment,
              "approved device pins the signed chain and opens its committed grant")
        check(accepted.pin.head == fixture.entries.last?.hash, "the pin contains the verified head")
        try checkRevocationWorkflow(fixture, keys: keys)
    } catch {
        check(false, "enrollment and revocation workflow completes")
    }
}

@available(iOS 17.0, macOS 14.0, *)
private func checkRevocationWorkflow(_ fixture: ChainFixture, keys: SealedScopeKeys) throws {
    let before = try SealedChain.verify(fixture.entries, account: "acct")
    let admin = EnrollAdmin(device: fixture.admin, state: before, keys: [keys.name: keys])
    let result = try admin.revoke(fixture.phone.deviceId, at: 3)
    let after = try SealedChain.verify(fixture.entries + result.entries, account: "acct")
    check(after.devices[fixture.phone.deviceId]?.active == false && after.scopes[keys.name]?.epoch == 1,
          "revocation rotates the revoked device's scope")
    check(Set(result.grants.map(\.device)) == [fixture.admin.deviceId, fixture.recovery.deviceId],
          "only remaining devices get the fresh epoch")
    guard let grant = result.grants.first(where: { $0.device == fixture.admin.deviceId }) else {
        throw SealedError("Rotation omitted the admin grant.")
    }
    let current = try after.openGrant(grant, as: fixture.admin)
    check(current.raw.dataKey != keys.raw.dataKey && current.raw.indexKey == keys.raw.indexKey,
          "rotation changes the content key and preserves object identifiers")
}

@available(iOS 17.0, macOS 14.0, *)
private func checkGrantAndSignerRefusals(
    _ request: EnrollRequest, _ fixture: ChainFixture, _ change: EnrollChange, _ receipt: EnrollReceipt
) {
    refuses("a joining device never pins before receiving each current grant") {
        _ = try request.accept(entries: fixture.entries, grants: [], approval: receipt)
    }
    refuses("a valid chain signed by a different key does not match the compared code") {
        let other = EnrollReceipt(account: receipt.account, claim: receipt.claim,
            approverSigningPublic: fixture.recovery.signingPublic, entryHash: receipt.entryHash)
        _ = try request.accept(entries: fixture.entries, grants: change.grants, approval: other)
    }
}
