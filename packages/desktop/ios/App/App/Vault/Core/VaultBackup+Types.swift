import CryptoKit
import Foundation

extension VaultBackup {
    public struct Snapshot {
        public let senderID: String
        public let createdAt: Int64

        public init(senderID: String, createdAt: Int64) {
            self.senderID = senderID
            self.createdAt = createdAt
        }
    }

    public struct Reader {
        public let recipientID: String
        public let now: Int64

        public init(recipientID: String, now: Int64) {
            self.recipientID = recipientID
            self.now = now
        }
    }

    public struct Recipient {
        public let id: String
        public let key: P256.KeyAgreement.PublicKey

        public init(id: String, key: P256.KeyAgreement.PublicKey) {
            self.id = id
            self.key = key
        }
    }

    public struct Trust {
        public let senderID: String
        public let key: P256.Signing.PublicKey
        public let expectedFingerprint: String?
        public let previous: Receipt?

        public init(senderID: String, key: P256.Signing.PublicKey, expectedFingerprint: String?, previous: Receipt?) {
            self.senderID = senderID
            self.key = key
            self.expectedFingerprint = expectedFingerprint
            self.previous = previous
        }
    }

    public struct Receipt: Codable, Equatable, Sendable {
        public let createdAt: Int64
        public let fingerprint: String
    }
}
