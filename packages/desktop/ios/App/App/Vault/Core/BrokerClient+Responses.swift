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
}
