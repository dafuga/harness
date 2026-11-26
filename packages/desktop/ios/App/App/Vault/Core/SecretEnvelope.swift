import CryptoKit
import Foundation

public struct SecretEnvelope: Codable, Equatable, Sendable {
    public let senderPublicKey: String
    public let salt: String
    public let ciphertext: String

    public static func seal(password: String?, otp: String?, to request: BrokerRequest) throws -> Self {
        try seal(
            password: password, otp: otp, to: request,
            using: .init(sender: .init(), salt: BrokerProtocol.random32Bytes())
        )
    }

    static func seal(
        password: String?, otp: String?, to request: BrokerRequest,
        using material: Material
    ) throws -> Self {
        let (sender, salt) = (material.sender, material.salt)
        guard password != nil || otp != nil, salt.count == 32,
              password.map({ !$0.isEmpty && $0.utf8.count <= 4_096 }) ?? true,
              otp.map({ !$0.isEmpty && $0.utf8.count <= 128 }) ?? true else {
            throw BrokerError.invalidCredential
        }
        let shared = try sender.sharedSecretFromKeyAgreement(with: request.verifiedSessionKey())
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/seal/v1".utf8),
            outputByteCount: 32
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        var plaintext = try encoder.encode(Secret(password: password, otp: otp))
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        guard plaintext.count <= 8_192 else { throw BrokerError.invalidCredential }
        let sealed = try ChaChaPoly.seal(
            plaintext, using: key, nonce: .init(data: Data(repeating: 0, count: 12)),
            authenticating: Data(request.id.utf8)
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

        private enum CodingKeys: CodingKey { case password, otp }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(password, forKey: .password)
            try container.encode(otp, forKey: .otp)
        }
    }
}
