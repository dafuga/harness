#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

struct PasswordImportFixture {
    static let deviceID = "daniel-iphone"
    static let id = "fedcba9876543210fedcba9876543210"

    let recipient = P256.KeyAgreement.PrivateKey()
    let summaryJSON: [String: Any]
    let review: ReviewedPasswordImport
    let delivery: PasswordImportDelivery

    private static let manifest = Data("""
    {"source":"grok-box","count":2,"services":[
    {"service":"demo-import","domain":"registry.example"},
    {"service":"demo-backup","domain":"backup.example"}
    ]}
    """.utf8)

    private static let bundle = Data("""
    {"entries":[
    {"service":"demo-import","domain":"registry.example","username":"fixture-user","password":"fixture-secret"},
    {"service":"demo-backup","domain":"backup.example","username":null,"password":"fixture-backup-secret"}
    ]}
    """.utf8)

    init(origin: String, expiresAt: Int64) throws {
        let manifest = Self.manifest
        let fingerprint = BrokerProtocol.fingerprint(recipient.publicKey.x963Representation)
        let shared = P256.KeyAgreement.PrivateKey()
        let salt = Data(repeating: 42, count: 32)
        let aad = Data(["CB-PASSWORD-IMPORT-V1", origin, Self.id, Self.deviceID, fingerprint,
                        BrokerProtocol.fingerprint(manifest)].joined(separator: "\n").utf8)
        let key = try shared.sharedSecretFromKeyAgreement(with: recipient.publicKey).hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt,
            sharedInfo: Data("credential-broker/password-import/v1".utf8), outputByteCount: 32
        )
        let box = try ChaChaPoly.seal(Self.bundle, using: key,
                                     nonce: .init(data: Data(repeating: 0, count: 12)), authenticating: aad)
        let ciphertext = box.ciphertext + box.tag
        summaryJSON = [
            "type": "password-import",
            "importId": Self.id,
            "recipientDeviceId": Self.deviceID,
            "importKeyFingerprint": fingerprint,
            "manifest": BrokerProtocol.base64url(manifest),
            "ciphertextSha256": BrokerProtocol.fingerprint(ciphertext),
            "expiresAt": expiresAt,
        ]
        let decoder = JSONDecoder()
        review = try decoder.decode(PasswordImportSummary.self, from: JSONSerialization.data(withJSONObject: summaryJSON))
            .review(for: Self.deviceID)
        let body: [String: Any] = [
            "importId": Self.id,
            "sealed": [
                "senderPublicKey": BrokerProtocol.base64url(shared.publicKey.x963Representation),
                "salt": BrokerProtocol.base64url(salt),
                "ciphertext": BrokerProtocol.base64url(ciphertext),
            ],
        ]
        delivery = try decoder.decode(PasswordImportDelivery.self, from: JSONSerialization.data(withJSONObject: body))
    }
}
#endif
