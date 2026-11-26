#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

@available(iOS 17.0, *)
struct VaultAddFixture {
    static let id = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"
    static let service = "npm-web"
    static let domain = "www.npmjs.com"
    static let account = "fixture-account"

    let recipient = P256.KeyAgreement.PrivateKey()
    let summary: VaultAddSummary
    let delivery: VaultAddDelivery

    init(origin: String, expiresAt: Int64) throws {
        let deviceID = PasswordImportFixture.deviceID
        let fingerprint = BrokerProtocol.fingerprint(recipient.publicKey.x963Representation)
        let key = recipient.publicKey
        func seal(_ purpose: String, _ value: [String: String]) throws -> ([String: String], String) {
            let sender = P256.KeyAgreement.PrivateKey()
            let salt = Data((0..<32).map { _ in UInt8.random(in: .min ... .max) })
            let sealing = try sender.sharedSecretFromKeyAgreement(with: key).hkdfDerivedSymmetricKey(
                using: SHA256.self, salt: salt,
                sharedInfo: Data("credential-broker/vault-add/v1".utf8), outputByteCount: 32
            )
            let aad = Data(["CB-VAULT-ADD-V1", origin, Self.id, deviceID, fingerprint, Self.service,
                            Self.domain, String(expiresAt), purpose].joined(separator: "\n").utf8)
            let box = try ChaChaPoly.seal(JSONEncoder().encode(value), using: sealing,
                                         nonce: .init(data: Data(repeating: 0, count: 12)), authenticating: aad)
            let ciphertext = box.ciphertext + box.tag
            return ([
                "senderPublicKey": BrokerProtocol.base64url(sender.publicKey.x963Representation),
                "salt": BrokerProtocol.base64url(salt),
                "ciphertext": BrokerProtocol.base64url(ciphertext)
            ], BrokerProtocol.fingerprint(ciphertext))
        }

        let (preview, previewDigest) = try seal("preview", ["username": Self.account])
        let (sealed, digest) = try seal("login", ["username": Self.account, "password": "fixture-add-password"])
        let metadata: [String: Any] = [
            "addId": Self.id, "recipientDeviceId": deviceID, "importKeyFingerprint": fingerprint,
            "service": Self.service, "domain": Self.domain, "expiresAt": expiresAt,
            "preview": preview, "previewSha256": previewDigest, "payloadSha256": digest,
        ]
        summary = try JSONDecoder().decode(VaultAddSummary.self, from: JSONSerialization.data(withJSONObject: metadata))
        delivery = try JSONDecoder().decode(VaultAddDelivery.self, from: JSONSerialization.data(
            withJSONObject: ["addId": Self.id, "sealed": sealed]
        ))
    }
}
#endif
