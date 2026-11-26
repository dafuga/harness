import CryptoKit
import Foundation

public enum BackupError: Error {
    case invalid
    case tooLarge
    case stale
    case verificationRequired
}

public struct VaultBackup {
    public static let maxBlobSize = 256 * 1_024

    private struct Package: Codable {
        let message: Data
        let signature: Data
    }

    private struct Message: Codable {
        let senderID: String
        let recipientID: String
        let version: Int
        let createdAt: Int64
        let ciphertext: DeviceBox
    }

    public static func seal(
        _ entries: [VaultEntry], from snapshot: Snapshot, to recipient: Recipient,
        sign: (Data) throws -> Data
    ) throws -> Data {
        let (senderID, createdAt) = (snapshot.senderID, snapshot.createdAt)
        guard BrokerProtocol.validDeviceID(senderID), BrokerProtocol.validDeviceID(recipient.id),
              createdAt > 0 else { throw BackupError.invalid }
        try validateEntries(entries)
        var plaintext = try JSONEncoder().encode(entries)
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        guard plaintext.count < maxBlobSize else { throw BackupError.tooLarge }
        let ciphertext = try DeviceBox.seal(
            plaintext, to: recipient.key, aad: aad(senderID, recipient.id, createdAt)
        )
        let message = try JSONEncoder().encode(Message(
            senderID: senderID, recipientID: recipient.id, version: 1, createdAt: createdAt,
            ciphertext: ciphertext
        ))
        let blob = try JSONEncoder().encode(Package(message: message, signature: try sign(signingInput(message))))
        guard blob.count <= maxBlobSize else { throw BackupError.tooLarge }
        return blob
    }

    public static func open(
        _ blob: Data, as reader: Reader, trust: Trust,
        agreement: (P256.KeyAgreement.PublicKey) throws -> SharedSecret
    ) throws -> (entries: [VaultEntry], receipt: Receipt) {
        let (recipientID, now) = (reader.recipientID, reader.now)
        guard blob.count <= maxBlobSize else { throw BackupError.tooLarge }
        let decoder = JSONDecoder()
        let package = try decoder.decode(Package.self, from: blob)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: package.signature)
        guard trust.key.isValidSignature(signature, for: signingInput(package.message)) else {
            throw BackupError.invalid
        }
        let message = try decoder.decode(Message.self, from: package.message)
        guard message.version == 1, message.senderID == trust.senderID, message.recipientID == recipientID,
              message.createdAt > 0, message.createdAt <= now + 300_000 else { throw BackupError.invalid }
        let receipt = Receipt(createdAt: message.createdAt, fingerprint: BrokerProtocol.fingerprint(blob))
        try verify(receipt, against: trust)
        var plaintext = try message.ciphertext.open(
            aad: aad(message.senderID, recipientID, message.createdAt), agreement: agreement
        )
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let entries = try decoder.decode([VaultEntry].self, from: plaintext)
        try validateEntries(entries)
        return (entries, receipt)
    }

    private static func verify(_ receipt: Receipt, against trust: Trust) throws {
        if let previous = trust.previous {
            guard receipt.createdAt > previous.createdAt || receipt == previous else { throw BackupError.stale }
        }
        // Each restore uses a reference obtained from the source device or a previously saved matching receipt.
        guard (trust.expectedFingerprint ?? trust.previous?.fingerprint) == receipt.fingerprint else {
            throw BackupError.verificationRequired
        }
    }

    private static func validateEntries(_ entries: [VaultEntry]) throws {
        guard Set(entries.map(\.id)).count == entries.count else { throw BackupError.invalid }
        for entry in entries { try entry.validate() }
    }

    private static func aad(_ sender: String, _ recipient: String, _ timestamp: Int64) -> Data {
        Data("credential-vault/backup/v1\n\(sender)\n\(recipient)\n\(timestamp)".utf8)
    }

    private static func signingInput(_ message: Data) -> Data {
        Data("credential-vault/backup-signature/v1\n".utf8) + message
    }
}
