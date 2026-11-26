import Foundation
import LocalAuthentication

extension VaultModel {
    enum RequestDecision {
        case sent
        case pending
        case accountMismatch
    }

    func decide(_ request: BrokerRequest, at connection: BrokerConnection, approved: Bool, otp: String) async
        -> RequestDecision {
        var outcome = RequestDecision.pending
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            _ = try request.verifiedSessionKey()
            guard let plan = try releasePlan(for: request, approved: approved, otp: otp) else { return }
            // Each decision gets its own biometric context.
            let context = try await authenticate(plan.reason)
            defer { context.invalidate() }
            let now = connection.releaseClock.now
            guard connection.live(request), now < request.expiresAt else { throw BrokerError.expired }
            let expiresAt = min(now + 60_000, request.expiresAt)
            guard let decision = try releaseDecision(
                for: request, plan: plan, expiresAt: expiresAt, context: context
            ) else {
                outcome = .accountMismatch
                return
            }
            try await send(decision, for: request, at: connection)
            outcome = .sent
        }
        return outcome
    }

    /// What was checked before the biometric prompt. `nil` means the vault item is missing.
    private func releasePlan(for request: BrokerRequest, approved: Bool, otp: String) throws -> ReleasePlan? {
        let approvalOnly = request.approvalOnly == true
        if approved && approvalOnly && request.requireServiceOtp == true {
            throw BrokerError.invalidRequest
        }
        let label = approved && !approvalOnly ? entry(for: request) : nil
        guard !approved || approvalOnly || label != nil else { return nil }
        let requiresOTP = approved && requiresServiceOTP(for: request)
        let code = otp.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !requiresOTP || !code.isEmpty else { throw DeviceVaultError.serviceCodeRequired }
        let reason = requiresOTP
            ? "Approve this credential request with fresh verification" : "Approve this request"
        return ReleasePlan(
            approved: approved, label: label, requiresOTP: requiresOTP, code: code,
            reason: approved ? reason : "Deny this request"
        )
    }

    /// `nil` means the saved account differs from the requested one, so nothing may be sealed.
    private func releaseDecision(
        for request: BrokerRequest, plan: ReleasePlan, expiresAt: Int64, context: LAContext
    ) throws -> BrokerClient.Decision? {
        if let label = plan.label {
            let entry = try vault.read(label.id, context: context)
            if let account = request.account, account != entry.username { return nil }
            let sealed = try SecretEnvelope.seal(
                password: entry.password, otp: plan.code.isEmpty ? nil : plan.code, to: request
            )
            return .init(approving: request, expiresAt: expiresAt, sealed: sealed, otpIncluded: plan.requiresOTP)
        } else if plan.approved {
            return .init(approvingOnly: request, expiresAt: expiresAt)
        } else {
            return .init(denying: request)
        }
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

    private struct ReleasePlan {
        let approved: Bool
        let label: EntryLabel?
        let requiresOTP: Bool
        let code: String
        let reason: String
    }
}
