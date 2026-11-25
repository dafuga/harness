import Foundation

/// An immutable review. The caller presents its code and requests authentication for that
/// review. The signing key and recipient used after authorization must match the review.
@available(iOS 17.0, macOS 14.0, *)
struct EnrollApproval {
    let code: String
    private let opening: EnrollOpening
    private let approver: String
    private let signingPublic: Data

    init(opening: EnrollOpening, claim: EnrollClaim, reveal: Data, approver: SealedDevice) throws {
        guard claim.approver == approver.deviceId, opening.deviceId != approver.deviceId,
            SealedEnroll.checkCommit(opening.keys, nonce: reveal, commitment: opening.commit)
        else { throw SealedError("Enrollment commitment or approver does not match.") }
        _ = try opening.chainDevice(scopes: [])
        self.opening = opening
        self.approver = approver.deviceId
        signingPublic = approver.signingPublic
        code = try SealedEnroll.code(request: opening.keys, requestNonce: reveal,
                                     approverSigningPublic: signingPublic, approverNonce: claim.nonce)
    }

    func authorize(
        with admin: EnrollAdmin, at: Int64, authenticate: () async -> Bool
    ) async throws -> EnrollChange? {
        let scopes = try approvedScopes(admin)
        guard await authenticate() else { return nil }
        let recipient = try opening.chainDevice(scopes: scopes)
        let body = SealedJson.object(["type": .string("enroll"), "device": recipient.json])
        let entry = try admin.sign(body, after: nil, at: at)
        let grants = try scopes.map { scope in
            try admin.grant(admin.currentKeys(scope).raw, to: recipient)
        }
        return EnrollChange(entries: [entry], grants: grants)
    }

    private func approvedScopes(_ admin: EnrollAdmin) throws -> [String] {
        let signer = try admin.activeAdmin()
        guard admin.device.deviceId == approver, signingPublic == admin.device.signingPublic,
            admin.state.devices[opening.deviceId] == nil, !signer.scopes.isEmpty
        else { throw SealedError("The device or approver changed after review.") }
        for scope in signer.scopes { _ = try admin.currentKeys(scope) }
        return signer.scopes.sorted()
    }
}
