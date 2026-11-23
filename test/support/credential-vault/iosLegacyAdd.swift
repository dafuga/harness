import CryptoKit
import Foundation

private struct LegacyVector: Decodable {
    struct Plaintext: Decodable, Equatable {
        let username: String
        let password: String?
    }

    struct Sample: Decodable {
        let plaintext: Plaintext
        let sealed: VaultLegacyAdd.Box
        let sha256: String

        func reviewed(as purpose: VaultLegacyAdd.Purpose) -> VaultLegacyAdd.ReviewedBox {
            VaultLegacyAdd.ReviewedBox(purpose: purpose, box: sealed, ciphertextSha256: sha256)
        }
    }

    let binding: VaultLegacyAdd
    let recipientPrivateKey: String
    let recipientPublicKey: String
    let preview: Sample
    let login: Sample

    func recipient() throws -> VaultLegacyAdd.Recipient {
        guard let data = RemoteCoding.data(base64url: recipientPrivateKey) else {
            throw VaultApprovalFailure.binding
        }
        let key = try P256.KeyAgreement.PrivateKey(rawRepresentation: data)
        guard RemoteCoding.base64url(key.publicKey.x963Representation) == recipientPublicKey else {
            throw VaultApprovalFailure.binding
        }
        return VaultLegacyAdd.Recipient(deviceId: binding.recipientDeviceId, publicKey: key.publicKey,
                                        agree: key.sharedSecretFromKeyAgreement(with:))
    }

    func matches(_ sample: Sample, purpose: VaultLegacyAdd.Purpose, to recipient: VaultLegacyAdd.Recipient) throws -> Bool {
        var bytes = try binding.open(sample.reviewed(as: purpose), to: recipient, now: binding.expiresAt - 1)
        defer { bytes.resetBytes(in: bytes.startIndex..<bytes.endIndex) }
        return try JSONDecoder().decode(Plaintext.self, from: bytes) == sample.plaintext
    }
}

func verifyLegacyAdd(_ path: String) throws -> Bool {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))
    let vector = try JSONDecoder().decode(LegacyVector.self, from: data)
    let binding = vector.binding
    let recipient = try vector.recipient()
    let login = vector.login.reviewed(as: .login)
    let wrongKey = P256.KeyAgreement.PrivateKey()
    let wrongRecipient = VaultLegacyAdd.Recipient(deviceId: binding.recipientDeviceId, publicKey: wrongKey.publicKey,
                                                   agree: wrongKey.sharedSecretFromKeyAgreement(with:))
    let replaced = VaultLegacyAdd.ReviewedBox(purpose: .login, box: vector.preview.sealed,
                                               ciphertextSha256: vector.login.sha256)
    guard try vector.matches(vector.preview, purpose: .preview, to: recipient),
        try vector.matches(vector.login, purpose: .login, to: recipient),
        (try? binding.open(login, to: wrongRecipient, now: binding.expiresAt - 1)) == nil,
        (try? binding.open(login, to: recipient, now: binding.expiresAt)) == nil,
        (try? binding.open(replaced, to: recipient, now: binding.expiresAt - 1)) == nil
    else { return false }
    let swapped = vector.preview.reviewed(as: .login)
    return (try? binding.open(swapped, to: recipient, now: binding.expiresAt - 1)) == nil
}
