#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

extension FixtureBroker {
    func pending(publishing key: VaultAddKeyPublication?, sign: BrokerClient.Sign) async throws -> BrokerClient.Pending {
        pollAttempts += 1
        if arguments.contains("--slow-request-poll") { try await Task.sleep(for: .seconds(10)) }
        if offline { throw BrokerError.serverUnreachable }
        if arguments.contains("--poll-access") { throw BrokerError.routeProtected }
        if arguments.contains("--poll-network"), pollAttempts == 1 { throw URLError(.notConnectedToInternet) }
        var body: [String: Any] = [
            "serverTime": Int64(Date().timeIntervalSince1970 * 1_000),
            "requests": try request.map {
                [try JSONSerialization.jsonObject(with: JSONEncoder().encode($0))]
            } ?? [],
        ]
        if let addFixture, let key, key.validUntil > Int64(Date().timeIntervalSince1970 * 1_000),
           key.vaultAddImportKey == BrokerProtocol.base64url(addFixture.recipient.publicKey.x963Representation) {
            publishedAddKey = true
        }
        if let addFixture, publishedAddKey, addDecision == nil {
            body["adds"] = [try JSONSerialization.jsonObject(with: JSONEncoder().encode(addFixture.summary))]
        }
        return try JSONDecoder().decode(BrokerClient.Pending.self, from: JSONSerialization.data(withJSONObject: body))
    }

    func decide(_ decision: BrokerClient.Decision, sign: BrokerClient.Sign) async throws {
        guard let request, let encoded = try JSONSerialization.jsonObject(
            with: JSONEncoder().encode(decision)
        ) as? [String: Any], encoded["requestId"] as? String == request.id,
              encoded["sessionKeyFingerprint"] as? String == request.sessionKeyFingerprint else {
            throw BrokerError.invalidRequest
        }
        if encoded["decision"] as? String == "approve" {
            guard request.requireServiceOtp != true || encoded["otpIncluded"] as? Bool == true else {
                throw BrokerError.invalidCredential
            }
            if arguments.contains("--approval-only") {
                guard encoded["approvalOnly"] as? Bool == true, encoded["sealed"] == nil,
                      encoded["otpIncluded"] == nil, let expiration = encoded["expiresAt"] as? Int64,
                      expiration <= request.expiresAt else { throw BrokerError.invalidRequest }
                _ = try await sign(Data(JSONEncoder().encode(decision)))
            } else {
                try verifyFixtureApproval(encoded, request: request)
            }
        } else if encoded["decision"] as? String != "deny" || encoded["sealed"] != nil {
            throw BrokerError.invalidRequest
        }
        self.request = nil
    }
}
#endif
