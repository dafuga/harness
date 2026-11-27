import Foundation

/// The public request keys of a device waiting for approval: two uncompressed P-256 points.
struct SealedEnrollKeys {
    let kemPublic: Data
    let signingPublic: Data

    func check(nonces: [Data]) throws {
        guard kemPublic.count == 65, signingPublic.count == 65 else {
            throw SealedError("Enrollment keys must be uncompressed P-256 points.")
        }
        guard nonces.allSatisfy({ $0.count == 32 }) else { throw SealedError("Nonces must be 32 bytes.") }
    }
}

/// Commit-reveal enrollment and the 6-digit code both screens show. The new device commits to
/// its keys before it sees the approver's nonce, so a server in the middle cannot grind a match.
enum SealedEnroll {
    /// Step 1, new device: hex SHA-256 over its keys and a secret nonce.
    static func commit(_ keys: SealedEnrollKeys, nonce: Data) throws -> String {
        try keys.check(nonces: [nonce])
        return RemoteCoding.hex(
            SealedBytes.sha256(
                SealedBytes.text("harness/sealed/v1/commit-enroll\0"), keys.kemPublic,
                keys.signingPublic, nonce))
    }

    /// Step 3, approver: the revealed nonce must open the commitment from step 1.
    static func checkCommit(_ keys: SealedEnrollKeys, nonce: Data, commitment: String) -> Bool {
        (try? commit(keys, nonce: nonce)) == commitment
    }

    /// The code: SHA-256 over the new device's keys, the approver's signing key and both nonces.
    static func code(
        request: SealedEnrollKeys, requestNonce: Data, approverSigningPublic: Data,
        approverNonce: Data
    ) throws -> String {
        try request.check(nonces: [requestNonce, approverNonce])
        guard approverSigningPublic.count == 65 else { throw SealedError("Approver key must be 65 bytes.") }
        let hash = SealedBytes.sha256(
            SealedBytes.text("harness/sealed/v1/sas\0"), request.kemPublic, request.signingPublic,
            approverSigningPublic, requestNonce, approverNonce)
        let value = SealedBytes.readU32(hash, at: 0) % 1_000_000
        return String(format: "%06u", value)
    }
}
