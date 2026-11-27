import Foundation
import LocalAuthentication

/// What Daniel chose on the review screen.
@available(iOS 17.0, *)
struct RequestAnswer {
    let approved: Bool
    var otp = ""
    var entry: UUID? = nil
}

@available(iOS 17.0, *)
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

    func pollPrivateOffer(_ connection: BrokerConnection) async -> Bool {
        guard isCurrent(connection), connection.configuration.role == .approver, !workInProgress,
              ContinuousClock.now >= connection.privateProbeAfter else { return false }
        let generation = connection.pollGeneration
        let revision = connection.queueRevision
        do {
            let offer = try await client(for: connection).privateBrowserOffer(sign: signer(for: connection))
            guard acceptsPrivatePoll(connection, generation: generation, revision: revision) else { return false }
            connection.privateOffer = offer
            guard let offer else { return false }
            return connection.remember("private-browser:\(offer.requestId)", until: offer.expiresAt,
                                       now: Int64(Date().timeIntervalSince1970 * 1_000))
        } catch {
            guard acceptsPrivatePoll(connection, generation: generation, revision: revision) else { return false }
            connection.privateOffer = nil
            connection.privateProbeAfter = .now.advanced(by: .seconds(30))
            return false
        }
    }

    private func acceptsPrivatePoll(_ connection: BrokerConnection, generation: Int, revision: Int) -> Bool {
        !Task.isCancelled && !workInProgress && isCurrent(connection)
            && connection.pollGeneration == generation && connection.queueRevision == revision
    }

    func submitPrivateFields(
        _ values: [String], for offer: PrivateBrowserOffer, at connection: BrokerConnection
    ) async -> Bool {
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(offer) else { throw BrokerError.expired }
            let context = try await authenticate("Approve this private browser entry")
            defer { context.invalidate() }
            guard !Task.isCancelled else { throw LAError(.appCancel) }
            guard isCurrent(connection), connection.live(offer) else { throw BrokerError.expired }
            do {
                let api = try client(for: connection)
                let completed = try await api.submitPrivateBrowserFields(values, for: offer, sign: signer(for: connection))
                connection.removePrivateOffer()
                guard completed else { throw BrokerError.privateEntryUnavailable }
            } catch where Task.isCancelled {
                throw LAError(.appCancel)
            }
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

@available(iOS 17.0, *)
extension BrokerConnection {
    func remaining(_ offer: PrivateBrowserOffer) -> Int64 {
        max(0, offer.expiresAt - Int64(Date().timeIntervalSince1970 * 1_000))
    }

    func live(_ offer: PrivateBrowserOffer) -> Bool {
        privateOffer == offer && remaining(offer) > 0
    }
}
