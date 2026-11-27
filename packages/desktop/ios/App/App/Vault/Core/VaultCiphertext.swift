import CryptoKit
import Foundation

struct DeviceBox: Codable, Equatable, Sendable {
    let sender: Data
    let box: Data

    static func seal(_ plaintext: Data, to recipient: P256.KeyAgreement.PublicKey, aad: Data) throws -> Self {
        let ephemeral = P256.KeyAgreement.PrivateKey()
        let sender = ephemeral.publicKey.x963Representation
        let secret = try ephemeral.sharedSecretFromKeyAgreement(with: recipient)
        let key = Self.key(secret, sender: sender, aad: aad)
        let sealed = try ChaChaPoly.seal(plaintext, using: key, authenticating: aad)
        return Self(sender: sender, box: sealed.combined)
    }

    func open(aad: Data, agreement: (P256.KeyAgreement.PublicKey) throws -> SharedSecret) throws -> Data {
        let senderKey = try P256.KeyAgreement.PublicKey(x963Representation: sender)
        let key = Self.key(try agreement(senderKey), sender: sender, aad: aad)
        return try ChaChaPoly.open(ChaChaPoly.SealedBox(combined: box), using: key, authenticating: aad)
    }

    private static func key(_ secret: SharedSecret, sender: Data, aad: Data) -> SymmetricKey {
        secret.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: sender, sharedInfo: aad, outputByteCount: 32
        )
    }
}

public struct VaultCiphertext: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let service: String
    let sender: Data
    let box: Data
    private let approvalRequired: Bool?
    /// Readable without Face ID so logins can be offered by site. Checked against the sealed entry.
    public private(set) var username: String? = nil
    public private(set) var domain: String? = nil

    public var twoFactorEveryTime: Bool { approvalRequired ?? false }

    init(id: UUID, service: String, sealed: DeviceBox, approvalRequired: Bool? = nil) {
        self.id = id
        self.service = service
        sender = sealed.sender
        box = sealed.box
        self.approvalRequired = approvalRequired
    }

    private var aad: Data { Self.aad(id: id, service: service) }

    public static func seal(_ entry: VaultEntry, to recipient: P256.KeyAgreement.PublicKey) throws -> Self {
        try entry.validate()
        var plaintext = try JSONEncoder().encode(entry)
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let sealed = try DeviceBox.seal(
            plaintext, to: recipient, aad: aad(id: entry.id, service: entry.service)
        )
        var record = Self(id: entry.id, service: entry.service, sealed: sealed,
                          approvalRequired: entry.twoFactorEveryTime ? true : nil)
        record.username = entry.username
        record.domain = entry.domain
        return record
    }

    public func open(agreement: (P256.KeyAgreement.PublicKey) throws -> SharedSecret) throws -> VaultEntry {
        var plaintext = try DeviceBox(sender: sender, box: box).open(aad: aad, agreement: agreement)
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let entry = try JSONDecoder().decode(VaultEntry.self, from: plaintext)
        try entry.validate()
        guard entry.id == id, entry.service == service, entry.twoFactorEveryTime == twoFactorEveryTime,
              username.map({ $0 == entry.username }) ?? true, domain.map({ $0 == entry.domain }) ?? true else {
            throw VaultError.invalidCiphertext
        }
        return entry
    }

    private static func aad(id: UUID, service: String) -> Data {
        Data("credential-vault/entry/v1\n\(id.uuidString)\n\(service)".utf8)
    }
}
