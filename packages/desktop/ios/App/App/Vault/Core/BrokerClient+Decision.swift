import Foundation

extension BrokerClient {
    public struct Decision: Encodable, Sendable {
        let requestId: String
        let sessionKeyFingerprint: String
        let decision: String
        let expiresAt: Int64?
        let sealed: SecretEnvelope?
        let otpIncluded: Bool?
        let approvalOnly: Bool?

        public init(denying request: BrokerRequest) {
            requestId = request.id
            sessionKeyFingerprint = request.sessionKeyFingerprint
            decision = "deny"
            expiresAt = nil
            sealed = nil
            otpIncluded = nil
            approvalOnly = nil
        }

        public init(approving request: BrokerRequest, expiresAt: Int64, sealed: SecretEnvelope, otpIncluded: Bool = false) {
            requestId = request.id
            sessionKeyFingerprint = request.sessionKeyFingerprint
            decision = "approve"
            self.expiresAt = expiresAt
            self.sealed = sealed
            self.otpIncluded = otpIncluded ? true : nil
            approvalOnly = nil
        }

        public init(approvingOnly request: BrokerRequest, expiresAt: Int64) {
            requestId = request.id
            sessionKeyFingerprint = request.sessionKeyFingerprint
            decision = "approve"
            self.expiresAt = expiresAt
            sealed = nil
            otpIncluded = nil
            approvalOnly = true
        }
    }
}
