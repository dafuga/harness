import CryptoKit
import Foundation

public enum PasswordImportError: Error {
    case invalidManifest
    case invalidBundle
    case recipientKeyMismatch
    case serviceConflict
    case deliveryInterrupted
}

public struct PasswordImportService: Codable, Equatable, Sendable {
    public let service: String
    public let domain: String

    private enum CodingKeys: String, CodingKey, CaseIterable { case service, domain }

    public init(from decoder: Decoder) throws {
        try requireKeys(in: decoder, CodingKeys.allCases)
        let values = try decoder.container(keyedBy: CodingKeys.self)
        service = try values.decode(String.self, forKey: .service)
        domain = try values.decode(String.self, forKey: .domain)
        guard BrokerProtocol.validDeviceID(service), Self.validDomain(domain) else {
            throw PasswordImportError.invalidManifest
        }
    }

    static func validDomain(_ domain: String) -> Bool {
        !domain.isEmpty && domain.utf8.count <= 253 && domain.split(separator: ".", omittingEmptySubsequences: false).allSatisfy {
            $0.range(of: #"\A[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\z"#, options: .regularExpression) != nil
        }
    }
}

public struct PasswordImportSummary: Codable, Equatable, Sendable {
    public let type: String
    public let importId: String
    public let recipientDeviceId: String
    public let importKeyFingerprint: String
    public let manifest: String
    public let ciphertextSha256: String
    public let expiresAt: Int64

    public func review(for deviceID: String) throws -> ReviewedPasswordImport {
        guard type == "password-import", BrokerProtocol.validRequestID(importId),
              recipientDeviceId == deviceID, BrokerProtocol.validDeviceID(recipientDeviceId),
              Self.validDigest(importKeyFingerprint), Self.validDigest(ciphertextSha256),
              manifest.utf8.count <= 88_000 else { throw PasswordImportError.invalidManifest }
        let bytes = try BrokerProtocol.decode(manifest)
        let decoded = try JSONDecoder().decode(Manifest.self, from: bytes)
        guard decoded.source == "grok-box", (1...100).contains(decoded.count),
              decoded.count == decoded.services.count else { throw PasswordImportError.invalidManifest }
        return ReviewedPasswordImport(summary: self, services: decoded.services,
                                      manifestSha256: BrokerProtocol.fingerprint(bytes))
    }

    private static func validDigest(_ value: String) -> Bool {
        value.range(of: #"\A[0-9a-f]{64}\z"#, options: .regularExpression) != nil
    }

    private struct Manifest: Decodable {
        let source: String
        let count: Int
        let services: [PasswordImportService]
        private enum CodingKeys: String, CodingKey, CaseIterable { case source, count, services }

        init(from decoder: Decoder) throws {
            try requireKeys(in: decoder, CodingKeys.allCases)
            let values = try decoder.container(keyedBy: CodingKeys.self)
            source = try values.decode(String.self, forKey: .source)
            count = try values.decode(Int.self, forKey: .count)
            services = try values.decode([PasswordImportService].self, forKey: .services)
        }
    }
}

public struct ReviewedPasswordImport: Identifiable, Equatable, Sendable {
    public let summary: PasswordImportSummary
    public let services: [PasswordImportService]
    public let manifestSha256: String

    public var id: String { summary.importId }
    public var expiresAt: Int64 { summary.expiresAt }

    public func verifyRecipient(_ key: P256.KeyAgreement.PublicKey) throws {
        guard BrokerProtocol.fingerprint(key.x963Representation) == summary.importKeyFingerprint else {
            throw PasswordImportError.recipientKeyMismatch
        }
    }

    func authenticatedData(origin: String) throws -> Data {
        _ = try BrokerProtocol.origin(origin)
        return Data(["CB-PASSWORD-IMPORT-V1", origin, id, summary.recipientDeviceId,
                     summary.importKeyFingerprint, manifestSha256].joined(separator: "\n").utf8)
    }
}

public struct PasswordImportDecision: Encodable, Sendable {
    public enum Choice: String, Encodable, Sendable { case approve, deny }

    public let importId: String
    public let decision: Choice
    public let manifestSha256: String
    public let ciphertextSha256: String

    public init(_ choice: Choice, request: ReviewedPasswordImport) {
        importId = request.id
        decision = choice
        manifestSha256 = request.manifestSha256
        ciphertextSha256 = request.summary.ciphertextSha256
    }
}

public struct PasswordImportCompletion: Codable, Equatable, Sendable {
    public let importId: String
    public let ciphertextSha256: String

    public init(request: ReviewedPasswordImport) {
        self.init(importId: request.id, digest: request.summary.ciphertextSha256)
    }

    init(importId: String, digest: String) {
        self.importId = importId
        ciphertextSha256 = digest
    }
}

private struct ImportJSONKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }

    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

func requireKeys(in decoder: Decoder, _ keys: [some CodingKey]) throws {
    let container = try decoder.container(keyedBy: ImportJSONKey.self)
    guard Set(container.allKeys.map(\.stringValue)) == Set(keys.map(\.stringValue)) else {
        throw PasswordImportError.invalidBundle
    }
}
