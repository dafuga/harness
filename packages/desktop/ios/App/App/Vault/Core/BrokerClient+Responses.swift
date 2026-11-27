import CryptoKit
import Foundation

extension BrokerClient {
    public struct Pending: Codable, Sendable {
        public let serverTime: Int64
        public let requests: [BrokerRequest]
        public var adds: [VaultAddSummary]? = nil
    }

    public struct PendingImports: Codable, Sendable {
        public let serverTime: Int64
        public let imports: [PasswordImportSummary]
    }

    struct Acknowledgment: Decodable { let ok: Bool }
    struct PrivateOfferReply: Decodable { let offer: PrivateBrowserOffer? }
    struct PrivateSubmitReply: Decodable {
        enum Status: String, Decodable { case completed, unavailable }
        let status: Status
    }
}

/// The reviewed scope shown in the native form. The recipient key must match its fingerprint.
public struct PrivateBrowserOffer: Decodable, Equatable, Sendable {
    public let executor: String
    public let origin: String
    public let field: String
    public let action: String
    public let requestId: String
    public let expiresAt: Int64
    let tabId: String
    let recipeDigest: String
    let runnerPublicKey: String
    let runnerFingerprint: String

    var website: String {
        String(origin.dropFirst("https://".count))
    }

    func recipient(now: Int64) throws -> Curve25519.KeyAgreement.PublicKey {
        guard now < expiresAt else { throw BrokerError.expired }
        _ = try BrokerProtocol.origin(origin)
        let key = try BrokerProtocol.decode(runnerPublicKey, size: 32)
        let identifier = #"\A[A-Za-z0-9][A-Za-z0-9_-]{0,127}\z"#
        guard expiresAt - now <= 90_000,
              UUID(uuidString: requestId)?.uuidString.lowercased() == requestId,
              recipeDigest.range(of: #"\A[0-9a-f]{64}\z"#, options: .regularExpression) != nil,
              [executor, action, field, tabId].allSatisfy({
                  $0.range(of: identifier, options: .regularExpression) != nil
              }),
              BrokerProtocol.fingerprint(key) == runnerFingerprint else { throw BrokerError.invalidRequest }
        return try Curve25519.KeyAgreement.PublicKey(rawRepresentation: key)
    }

    func seal(_ value: String, now: Int64) throws -> Data {
        var plaintext = Data(value.utf8)
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let key = try recipient(now: now)
        let sealed = try SecretEnvelope.seal(
            plaintext, to: key, requestID: requestId,
            using: .init(sender: .init(), salt: BrokerProtocol.random32Bytes())
        )
        return try JSONEncoder().encode(Submission(offer: self, sealed: sealed))
    }

    private struct Submission: Encodable {
        let offer: PrivateBrowserOffer
        let sealed: SecretEnvelope

        enum CodingKeys: String, CodingKey {
            case executor, origin, field, action, requestId, expiresAt, tabId, recipeDigest, runnerFingerprint, sealed
        }

        func encode(to encoder: Encoder) throws {
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode(offer.executor, forKey: .executor)
            try fields.encode(offer.origin, forKey: .origin)
            try fields.encode(offer.field, forKey: .field)
            try fields.encode(offer.action, forKey: .action)
            try fields.encode(offer.requestId, forKey: .requestId)
            try fields.encode(offer.expiresAt, forKey: .expiresAt)
            try fields.encode(offer.tabId, forKey: .tabId)
            try fields.encode(offer.recipeDigest, forKey: .recipeDigest)
            try fields.encode(offer.runnerFingerprint, forKey: .runnerFingerprint)
            try fields.encode(sealed, forKey: .sealed)
        }
    }
}
