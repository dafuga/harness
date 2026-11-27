import CryptoKit
import Foundation

public struct SecretEnvelope: Codable, Equatable, Sendable {
    public let senderPublicKey: String
    public let salt: String
    public let ciphertext: String

    public static func seal(password: String?, otp: String?, to request: BrokerRequest) throws -> Self {
        // A bound request carries its website inside the envelope, where the relay cannot change it.
        try seal(
            password: password, otp: otp, to: request,
            using: .init(sender: .init(), salt: BrokerProtocol.random32Bytes())
        )
    }

    static func seal(
        password: String?, otp: String?, to request: BrokerRequest,
        using material: Material
    ) throws -> Self {
        guard password != nil || otp != nil,
              password.map({ !$0.isEmpty && $0.utf8.count <= 4_096 }) ?? true,
              otp.map({ !$0.isEmpty && $0.utf8.count <= 128 }) ?? true else {
            throw BrokerError.invalidCredential
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        var plaintext = try encoder.encode(
            Secret(password: password, otp: otp, websiteDomain: request.websiteDomain)
        )
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        return try seal(
            plaintext, to: request.verifiedSessionKey(), requestID: request.id, using: material
        )
    }

    static func seal(
        _ plaintext: Data, to recipient: Curve25519.KeyAgreement.PublicKey,
        requestID: String, using material: Material
    ) throws -> Self {
        let (sender, salt) = (material.sender, material.salt)
        guard (1...8_192).contains(plaintext.count), salt.count == 32 else { throw BrokerError.invalidCredential }
        let shared = try sender.sharedSecretFromKeyAgreement(with: recipient)
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/seal/v1".utf8),
            outputByteCount: 32
        )
        let sealed = try ChaChaPoly.seal(
            plaintext, using: key, nonce: .init(data: Data(repeating: 0, count: 12)),
            authenticating: Data(requestID.utf8)
        )
        return Self(
            senderPublicKey: BrokerProtocol.base64url(sender.publicKey.rawRepresentation),
            salt: BrokerProtocol.base64url(salt),
            ciphertext: BrokerProtocol.base64url(sealed.ciphertext + sealed.tag)
        )
    }

    struct Material {
        let sender: Curve25519.KeyAgreement.PrivateKey
        let salt: Data
    }

    private struct Secret: Encodable {
        let password: String?
        let otp: String?
        let websiteDomain: String?

        private enum CodingKeys: CodingKey { case password, otp, websiteDomain }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(password, forKey: .password)
            try container.encode(otp, forKey: .otp)
            try container.encodeIfPresent(websiteDomain, forKey: .websiteDomain)
        }
    }
}
