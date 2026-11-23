#if DEBUG
import CryptoKit
import Foundation
import LocalAuthentication
import Security

/// Exercises the legacy envelope and native storage on a physical device using a fresh test entry.
struct VaultLegacyFixture {
    let review: VaultLegacyImportReview
    let login: VaultLegacyAdd.Box
    let recipient: VaultLegacyImportKeychain.Recipient

    static func preview() async throws -> VaultLegacyFixture {
        guard SecureEnclave.isAvailable, let control = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, [.privateKeyUsage, .biometryCurrentSet], nil
        ) else { throw VaultImportFailure.storage }
        let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(accessControl: control)
        let binding = testBinding(key.publicKey)
        let username = "synthetic-" + binding.addId.prefix(12)
        let preview = try seal(["username": username], to: key.publicKey, binding: binding, purpose: .preview)
        let login = try seal(["username": username, "password": "synthetic-legacy-check"], to: key.publicKey,
                             binding: binding, purpose: .login)
        let offer = VaultLegacyImportReview.Offer(binding: binding, preview: preview, loginDigest: login.ciphertextSha256)
        let recipient = fixtureRecipient(key.dataRepresentation, deviceId: binding.recipientDeviceId)
        let review = try await VaultLegacyImportKeychain.preview(offer, to: recipient)
        return VaultLegacyFixture(review: review, login: login.box, recipient: recipient)
    }

    func confirm() async throws -> String {
        try await VaultLegacyImportKeychain.confirm(review, login: login, to: recipient)
    }

    private static func testBinding(_ key: P256.KeyAgreement.PublicKey) -> VaultLegacyAdd {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        return VaultLegacyAdd(origin: "https://legacy.example.test", addId: UUID().uuidString.lowercased(),
                              recipientDeviceId: "synthetic-native-iphone",
                              importKeyFingerprint: RemoteCoding.hex(RemoteCoding.sha256(key.x963Representation)),
                              service: "synthetic-legacy-check", domain: "console.example.test", expiresAt: now + 120_000)
    }

    private static func fixtureRecipient(_ wrapped: Data, deviceId: String) -> VaultLegacyImportKeychain.Recipient {
        { context in
            let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(dataRepresentation: wrapped, authenticationContext: context)
            return VaultLegacyAdd.Recipient(deviceId: deviceId, publicKey: key.publicKey,
                                            agree: { try key.sharedSecretFromKeyAgreement(with: $0) })
        }
    }

    private static func seal(
        _ body: [String: String], to recipient: P256.KeyAgreement.PublicKey,
        binding: VaultLegacyAdd, purpose: VaultLegacyAdd.Purpose
    ) throws -> VaultLegacyAdd.ReviewedBox {
        guard var bytes = RemoteCoding.json(body) else { throw VaultImportFailure.invalidPayload }
        defer { bytes.resetBytes(in: bytes.startIndex..<bytes.endIndex) }
        let sender = P256.KeyAgreement.PrivateKey()
        let salt = RemoteCoding.random(32)
        let shared = try sender.sharedSecretFromKeyAgreement(with: recipient)
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/vault-add/v1".utf8), outputByteCount: 32)
        let nonce = try ChaChaPoly.Nonce(data: Data(count: 12))
        let sealed = try ChaChaPoly.seal(bytes, using: key, nonce: nonce, authenticating: binding.authenticated(purpose))
        let ciphertext = sealed.ciphertext + sealed.tag
        let box = VaultLegacyAdd.Box(senderPublicKey: RemoteCoding.base64url(sender.publicKey.x963Representation),
                                     salt: RemoteCoding.base64url(salt), ciphertext: RemoteCoding.base64url(ciphertext))
        return VaultLegacyAdd.ReviewedBox(purpose: purpose, box: box, ciphertextSha256: RemoteCoding.hex(RemoteCoding.sha256(ciphertext)))
    }
}
#endif
