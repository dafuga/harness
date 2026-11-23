import CryptoKit
import Foundation

/// The standalone broker's single-entry add format. The caller supplies an authenticated offer
/// and obtains biometric authorization separately before opening the preview and login.
struct VaultLegacyAdd: Decodable {
    enum Purpose: String {
        case preview, login

        var limit: Int { self == .preview ? 8 * 1024 : 32 * 1024 }
    }

    struct Box: Decodable {
        let senderPublicKey: String
        let salt: String
        let ciphertext: String
    }

    struct ReviewedBox {
        let purpose: Purpose
        let box: Box
        let ciphertextSha256: String
    }

    struct Recipient {
        let deviceId: String
        let publicKey: P256.KeyAgreement.PublicKey
        let agree: (P256.KeyAgreement.PublicKey) throws -> SharedSecret
    }

    let origin: String
    let addId: String
    let recipientDeviceId: String
    let importKeyFingerprint: String
    let service: String
    let domain: String
    let expiresAt: Int64

    func open(_ reviewed: ReviewedBox, to recipient: Recipient, now: Int64) throws -> Data {
        let box = reviewed.box
        guard now < expiresAt else { throw VaultApprovalFailure.expired }
        guard Self.validDomain(domain), recipientDeviceId == recipient.deviceId,
            importKeyFingerprint == RemoteCoding.hex(RemoteCoding.sha256(recipient.publicKey.x963Representation)),
            let sender = RemoteCoding.data(base64url: box.senderPublicKey), sender.count == 65, sender.first == 4,
            let salt = RemoteCoding.data(base64url: box.salt), salt.count == 32,
            box.ciphertext.utf8.count <= (reviewed.purpose.limit * 4 + 2) / 3,
            let sealed = RemoteCoding.data(base64url: box.ciphertext),
            (17...reviewed.purpose.limit).contains(sealed.count),
            RemoteCoding.hex(RemoteCoding.sha256(sealed)) == reviewed.ciphertextSha256
        else { throw VaultApprovalFailure.binding }
        let aad = try authenticated(reviewed.purpose)
        let peer = try P256.KeyAgreement.PublicKey(x963Representation: sender)
        let shared = try recipient.agree(peer)
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/vault-add/v1".utf8), outputByteCount: 32)
        let nonce = try ChaChaPoly.Nonce(data: Data(count: 12))
        let envelope = try ChaChaPoly.SealedBox(nonce: nonce, ciphertext: sealed.dropLast(16), tag: sealed.suffix(16))
        return try ChaChaPoly.open(envelope, using: key, authenticating: aad)
    }

    func authenticated(_ purpose: Purpose) throws -> Data {
        let fields = ["CB-VAULT-ADD-V1", origin, addId, recipientDeviceId, importKeyFingerprint,
                      service, domain, String(expiresAt), purpose.rawValue]
        guard fields.allSatisfy({ $0.utf8.allSatisfy { (32...126).contains($0) } })
        else { throw VaultApprovalFailure.binding }
        return Data(fields.joined(separator: "\n").utf8)
    }

    private static func validDomain(_ domain: String) -> Bool {
        guard domain.utf8.count <= 253 else { return false }
        let labels = domain.split(separator: ".", omittingEmptySubsequences: false)
        guard labels.count > 1, labels.allSatisfy({ label in
            (1...63).contains(label.utf8.count) && label.first != "-" && label.last != "-" &&
                label.utf8.allSatisfy { (97...122).contains($0) || (48...57).contains($0) || $0 == 45 }
        }) else { return false }
        return labels.count != 4 || !labels.allSatisfy { UInt8($0) != nil }
    }
}
