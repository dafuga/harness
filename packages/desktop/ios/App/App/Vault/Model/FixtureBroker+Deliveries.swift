#if DEBUG && targetEnvironment(simulator)
import Foundation

extension FixtureBroker {
    func decideVaultAdd(_ decision: VaultAddDecision, sign: BrokerClient.Sign) async throws -> VaultAddDelivery? {
        guard let addFixture, decision.addId == addFixture.summary.id,
              decision.payloadSha256 == addFixture.summary.payloadSha256 else { throw BrokerError.http(409) }
        _ = try await sign(JSONEncoder().encode(decision))
        if decision.decision == .stored {
            guard decision.previewSha256 == nil, addDecision == .approve else { throw BrokerError.http(409) }
            return nil
        }
        guard addDecision == nil, decision.previewSha256 == addFixture.summary.previewSha256 else {
            throw BrokerError.http(409)
        }
        addDecision = decision.decision
        return decision.decision == .approve ? addFixture.delivery : nil
    }

    func pendingImports(sign: BrokerClient.Sign) async throws -> BrokerClient.PendingImports {
        let body: [String: Any] = [
            "serverTime": Int64(Date().timeIntervalSince1970 * 1_000),
            "imports": importDelivered ? [] : importFixture.map { [$0.summaryJSON] } ?? [],
        ]
        return try JSONDecoder().decode(BrokerClient.PendingImports.self, from: JSONSerialization.data(withJSONObject: body))
    }

    func decideImport(
        _ decision: PasswordImportDecision, sign: BrokerClient.Sign
    ) async throws -> PasswordImportDelivery? {
        guard let importFixture, !importDelivered,
              decision.importId == importFixture.review.id,
              decision.manifestSha256 == importFixture.review.manifestSha256,
              decision.ciphertextSha256 == importFixture.review.summary.ciphertextSha256 else {
            throw BrokerError.http(409)
        }
        importDelivered = true
        return decision.decision == .approve ? importFixture.delivery : nil
    }

    func completeImport(_ completion: PasswordImportCompletion, sign: BrokerClient.Sign) async throws {
        guard let importFixture, importDelivered, completion == .init(request: importFixture.review) else {
            throw BrokerError.http(409)
        }
    }

    func upload(_ blob: Data, recipientID: String, sign: BrokerClient.Sign) async throws {
        throw BrokerError.transport
    }

    func download(sign: BrokerClient.Sign) async throws -> Data {
        throw BrokerError.transport
    }
}
#endif
