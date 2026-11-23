import Foundation

struct VaultInbox {
    private struct Decision: Decodable { let status: String }
    let channel: VaultRemoteChannel
    private let phone: VaultDeviceApproval

    init(session: RemoteSession) async throws {
        let channel = try await session.openVaultChannel()
        let scope = try await channel.required("vaultInfo", as: VaultDeviceApproval.Scope.self)
        guard let origin = URL(string: scope.origin), origin.scheme == "https",
            origin.host?.hasSuffix(".test") == true else { throw VaultApprovalFailure.binding }
        self.channel = channel
        self.phone = VaultDeviceApproval(scope: scope)
    }

    var deviceId: String { phone.scope.deviceId }

    func enroll() async throws -> String { try await phone.enroll() }

    func requests() async throws -> [VaultApprovalRequest] {
        let challenge = try await challenge()
        let proof = try await phone.queue(challenge)
        let entries = try await channel.required("vaultQueue", input: body(proof), as: [VaultApprovalRequest].self)
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        return entries.filter { $0.syntheticFixture && (try? $0.recipient(now: now)) != nil }
    }

    func decide(_ request: VaultApprovalRequest, approve: Bool) async throws {
        guard request.syntheticFixture else { throw VaultApprovalFailure.binding }
        let challenge = try await challenge()
        let proof = try await phone.decide(request, challenge: challenge) { _ in
            approve ? request.fixtureIntent : .deny
        }
        let decision = try await channel.required("vaultDecision", input: body(proof), as: Decision.self)
        guard decision.status == (approve ? "approved" : "denied") else { throw VaultApprovalFailure.binding }
    }

    private func challenge() async throws -> VaultDeviceChallenge {
        try await channel.required("vaultChallenge", as: VaultDeviceChallenge.self)
    }

    private func body(_ proof: VaultDeviceProof) -> [String: Any] {
        ["deviceId": proof.deviceId, "nonce": proof.nonce, "payload": proof.payload, "signature": proof.signature]
    }
}

private extension VaultApprovalRequest {
    var syntheticFixture: Bool {
        environment == "synthetic" && site == "example-console" && account == "synthetic-owner" &&
            !origins.isEmpty && origins.allSatisfy { URL(string: $0)?.host?.hasSuffix(".test") == true }
    }

    var fixtureIntent: VaultApprovalIntent {
        switch method {
        case .browser: return .browser(password: "canary-password-7f3a")
        case .apiToken: return .apiToken("synthetic-ios-api-token")
        case .oauthDevice: return .deviceGrant
        }
    }
}
