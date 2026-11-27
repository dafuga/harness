import CryptoKit
import Foundation

public struct PasswordImportDelivery: Codable, Sendable {
    public struct Sealed: Codable, Equatable, Sendable {
        public let senderPublicKey: String
        public let salt: String
        public let ciphertext: String
    }

    public let importId: String
    public let sealed: Sealed

    public func open(
        request: ReviewedPasswordImport, origin: String, recipient: P256.KeyAgreement.PublicKey,
        agreement: (P256.KeyAgreement.PublicKey) throws -> SharedSecret
    ) throws -> [VaultEntry] {
        try request.verifyRecipient(recipient)
        let maxPlaintext = 64 * 1_024
        guard importId == request.id, sealed.ciphertext.utf8.count <= 87_403 else {
            throw PasswordImportError.invalidBundle
        }
        let combined = try BrokerProtocol.decode(sealed.ciphertext)
        guard (16...(maxPlaintext + 16)).contains(combined.count),
              BrokerProtocol.fingerprint(combined) == request.summary.ciphertextSha256 else {
            throw PasswordImportError.invalidBundle
        }
        let sender = try P256.KeyAgreement.PublicKey(
            x963Representation: BrokerProtocol.decode(sealed.senderPublicKey, size: 65)
        )
        let salt = try BrokerProtocol.decode(sealed.salt, size: 32)
        let key = try agreement(sender).hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/password-import/v1".utf8),
            outputByteCount: 32
        )
        let box = try ChaChaPoly.SealedBox(combined: Data(repeating: 0, count: 12) + combined)
        var plaintext = try ChaChaPoly.open(box, using: key, authenticating: request.authenticatedData(origin: origin))
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let bundle = try JSONDecoder().decode(Bundle.self, from: plaintext)
        guard bundle.entries.count == request.services.count else { throw PasswordImportError.invalidBundle }
        return try zip(bundle.entries, request.services).map { entry, service in
            try entry.checkedEntry(matching: service)
        }
    }

    private struct Bundle: Decodable {
        let entries: [Entry]
        private enum CodingKeys: String, CodingKey, CaseIterable { case entries }

        init(from decoder: Decoder) throws {
            try requireKeys(in: decoder, CodingKeys.allCases)
            entries = try decoder.container(keyedBy: CodingKeys.self).decode([Entry].self, forKey: .entries)
        }
    }

    private struct Entry: Decodable {
        let service: String
        let domain: String
        let username: String?
        let password: String
        private enum CodingKeys: String, CodingKey, CaseIterable { case service, domain, username, password }

        init(from decoder: Decoder) throws {
            try requireKeys(in: decoder, CodingKeys.allCases)
            let values = try decoder.container(keyedBy: CodingKeys.self)
            service = try values.decode(String.self, forKey: .service)
            domain = try values.decode(String.self, forKey: .domain)
            username = try values.decodeIfPresent(String.self, forKey: .username)
            password = try values.decode(String.self, forKey: .password)
        }

        func checkedEntry(matching row: PasswordImportService) throws -> VaultEntry {
            guard service == row.service, domain == row.domain else { throw PasswordImportError.invalidBundle }
            var entry = VaultEntry(service: service, username: username ?? "", password: password)
            entry.domain = domain
            try entry.validate()
            return entry
        }
    }
}
