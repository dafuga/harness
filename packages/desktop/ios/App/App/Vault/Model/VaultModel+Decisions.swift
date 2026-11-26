import Foundation
import LocalAuthentication

/// What Daniel chose on the review screen.
struct RequestAnswer {
    let approved: Bool
    var otp = ""
    var entry: UUID? = nil
}

extension VaultModel {
    /// True once the broker has recorded the answer.
    func decide(_ request: BrokerRequest, at connection: BrokerConnection, answer: RequestAnswer) async -> Bool {
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            _ = try request.verifiedSessionKey()
            let release = VaultRelease(request: request, code: answer.otp)
            let label = try checkedLogin(for: release, answer: answer)
            // Each decision gets its own biometric context.
            let context = try await authenticate(reason(for: release, answer: answer))
            defer { context.invalidate() }
            let now = connection.releaseClock.now
            guard connection.live(request), now < request.expiresAt else { throw BrokerError.expired }
            var decision = BrokerClient.Decision(denying: request)
            if answer.approved {
                decision = try release.approval(
                    login: label.map { try vault.read($0.id, context: context) },
                    expiresAt: min(now + 60_000, request.expiresAt), origin: connection.machine.origin
                )
            }
            try await send(decision, for: request, at: connection)
        }
    }

    /// Everything that can be checked before the biometric prompt.
    private func checkedLogin(for release: VaultRelease, answer: RequestAnswer) throws -> EntryLabel? {
        guard answer.approved else { return nil }
        let request = release.request
        guard !requiresServiceOTP(for: request, entry: answer.entry) || !release.code.isEmpty else {
            throw VaultReleaseError.codeRequired
        }
        guard release.takesPassword else { return nil }
        guard let label = entry(answer.entry, for: request) else { throw VaultReleaseError.loginRequired }
        return label
    }

    private func reason(for release: VaultRelease, answer: RequestAnswer) -> String {
        guard answer.approved else { return "Deny this request" }
        return requiresServiceOTP(for: release.request, entry: answer.entry)
            ? "Approve this credential request with fresh verification" : "Approve this request"
    }

    private func send(
        _ decision: BrokerClient.Decision, for request: BrokerRequest, at connection: BrokerConnection
    ) async throws {
        do {
            try await client(for: connection).decide(decision, sign: signer(for: connection))
            connection.remove(request)
        } catch BrokerError.http(409) {
            connection.remove(request)
            throw BrokerError.expired
        }
    }
}
