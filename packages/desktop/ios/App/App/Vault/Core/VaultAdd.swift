import CryptoKit
import Foundation
import Network

public enum VaultAddError: Error {
    case invalidRequest
    case invalidEnvelope
    case reviewExpired
}

public struct VaultAddKeyPublication: Encodable, Sendable {
    public let vaultAddImportKey: String
    public let validUntil: Int64

    public init(publicKey: P256.KeyAgreement.PublicKey, validUntil: Int64) {
        vaultAddImportKey = BrokerProtocol.base64url(publicKey.x963Representation)
        self.validUntil = validUntil
    }
}

public struct VaultRecipient {
    public let publicKey: P256.KeyAgreement.PublicKey
    public let agree: (P256.KeyAgreement.PublicKey) throws -> SharedSecret

    public init(
        publicKey: P256.KeyAgreement.PublicKey,
        agree: @escaping (P256.KeyAgreement.PublicKey) throws -> SharedSecret
    ) {
        self.publicKey = publicKey
        self.agree = agree
    }
}

public struct VaultAddSummary: Codable, Equatable, Identifiable, Sendable {
    public static let maximumLifetime: Int64 = 300_000

    public let addId: String
    public let recipientDeviceId: String
    public let importKeyFingerprint: String
    public let service: String
    public let domain: String
    public let expiresAt: Int64
    public let preview: PasswordImportDelivery.Sealed
    public let previewSha256: String
    public let payloadSha256: String

    public var id: String { addId }

    public func validate(for deviceID: String) throws {
        let exactDomains = ["npm-web": "www.npmjs.com", "openai-platform": "auth.openai.com"]
        guard BrokerProtocol.validRequestID(addId), recipientDeviceId == deviceID,
              BrokerProtocol.validDeviceID(recipientDeviceId), BrokerProtocol.validDeviceID(service),
              domain.contains("."), IPv4Address(domain) == nil, PasswordImportService.validDomain(domain),
              exactDomains[service].map({ $0 == domain }) ?? true,
              [importKeyFingerprint, previewSha256, payloadSha256].allSatisfy(Self.isDigest),
              expiresAt > 0 else { throw VaultAddError.invalidRequest }
    }

    private static func isDigest(_ value: String) -> Bool {
        value.range(of: #"\A[0-9a-f]{64}\z"#, options: .regularExpression) != nil
    }

    public func openAccount(origin: String, recipient: VaultRecipient) throws -> String {
        let account: Account = try open(preview, purpose: .preview, origin: origin, recipient: recipient)
        return account.username
    }

    public func openLogin(
        _ delivery: VaultAddDelivery, reviewedAccount: String, origin: String, recipient: VaultRecipient
    ) throws -> VaultEntry {
        guard delivery.addId == addId,
              delivery.sealed.senderPublicKey != preview.senderPublicKey,
              delivery.sealed.salt != preview.salt else { throw VaultAddError.invalidEnvelope }
        let login: Login = try open(delivery.sealed, purpose: .login, origin: origin, recipient: recipient)
        guard login.username.utf8.elementsEqual(reviewedAccount.utf8) else { throw VaultAddError.invalidEnvelope }
        var entry = VaultEntry(service: service, username: login.username, password: login.password)
        entry.domain = domain
        try entry.validate()
        return entry
    }

    private enum Purpose: String { case preview, login }

    private func open<Value: Decodable>(
        _ sealed: PasswordImportDelivery.Sealed, purpose: Purpose, origin: String, recipient: VaultRecipient
    ) throws -> Value {
        let limit = purpose == .preview ? 8 * 1_024 : 32 * 1_024
        let digest = purpose == .preview ? previewSha256 : payloadSha256
        guard sealed.ciphertext.utf8.count <= (limit * 4 + 2) / 3,
              BrokerProtocol.fingerprint(recipient.publicKey.x963Representation) == importKeyFingerprint else {
            throw VaultAddError.invalidEnvelope
        }
        _ = try BrokerProtocol.origin(origin)
        let ciphertext = try BrokerProtocol.decode(sealed.ciphertext)
        guard (17...limit).contains(ciphertext.count), BrokerProtocol.fingerprint(ciphertext) == digest else {
            throw VaultAddError.invalidEnvelope
        }
        let sender = try P256.KeyAgreement.PublicKey(
            x963Representation: BrokerProtocol.decode(sealed.senderPublicKey, size: 65)
        )
        let key = try recipient.agree(sender).hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: BrokerProtocol.decode(sealed.salt, size: 32),
            sharedInfo: Data("credential-broker/vault-add/v1".utf8), outputByteCount: 32
        )
        let aad = Data(["CB-VAULT-ADD-V1", origin, addId, recipientDeviceId,
                        importKeyFingerprint, service, domain, String(expiresAt), purpose.rawValue]
            .joined(separator: "\n").utf8)
        let box = try ChaChaPoly.SealedBox(combined: Data(repeating: 0, count: 12) + ciphertext)
        var plaintext = try ChaChaPoly.open(box, using: key, authenticating: aad)
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        return try JSONDecoder().decode(Value.self, from: plaintext)
    }

    private struct Account: Decodable {
        let username: String
        private enum CodingKeys: String, CodingKey { case username }

        init(from decoder: Decoder) throws {
            try requireKeys(in: decoder, [CodingKeys.username])
            let fields = try decoder.container(keyedBy: CodingKeys.self)
            username = try fields.decode(String.self, forKey: .username)
            guard !username.isEmpty, username.utf8.count <= 1_024,
                  !username.unicodeScalars.contains(where: {
                      CharacterSet.controlCharacters.contains($0) || (0x2066...0x2069).contains($0.value)
                  }) else { throw VaultAddError.invalidEnvelope }
        }
    }

    private struct Login: Decodable {
        let username: String
        let password: String
        private enum CodingKeys: String, CodingKey, CaseIterable { case username, password }

        init(from decoder: Decoder) throws {
            try requireKeys(in: decoder, CodingKeys.allCases)
            let fields = try decoder.container(keyedBy: CodingKeys.self)
            username = try fields.decode(String.self, forKey: .username)
            password = try fields.decode(String.self, forKey: .password)
        }
    }
}

public struct VaultAddDelivery: Codable, Sendable {
    public let addId: String
    public let sealed: PasswordImportDelivery.Sealed
}

public struct VaultAddDecision: Encodable, Sendable {
    public enum Choice: String, Encodable, Sendable { case approve, deny, stored }

    public let addId: String
    public let decision: Choice
    public let previewSha256: String?
    public let payloadSha256: String

    public init(_ choice: Choice, request: VaultAddSummary) {
        addId = request.id
        decision = choice
        previewSha256 = choice == .stored ? nil : request.previewSha256
        payloadSha256 = request.payloadSha256
    }

    public init(stored addID: String, digest: String) {
        addId = addID
        decision = .stored
        previewSha256 = nil
        payloadSha256 = digest
    }
}
