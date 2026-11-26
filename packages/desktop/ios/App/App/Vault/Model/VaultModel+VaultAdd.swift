import Foundation
import LocalAuthentication

@available(iOS 17.0, *)
struct VaultAddReview {
    let account: String
    let request: VaultAddSummary
    let origin: String
    private let deadline = ContinuousClock.now.advanced(by: .seconds(45))

    var isCurrent: Bool { ContinuousClock.now < deadline }
}

@available(iOS 17.0, *)
extension VaultModel {
    func vaultAddPublication(for connection: BrokerConnection) -> VaultAddKeyPublication? {
        guard connection.releaseClock.isSynchronized,
              ContinuousClock.now >= connection.publishImportKeyAfter else { return nil }
        let context = LAContext()
        context.interactionNotAllowed = true
        defer { context.invalidate() }
        guard let key = try? importRecipient(context, at: connection).publicKey else { return nil }
        return VaultAddKeyPublication(publicKey: key, validUntil: connection.releaseClock.now + 120_000)
    }

    func applyVaultAddQueue(_ queue: [VaultAddSummary], to connection: BrokerConnection) -> Bool {
        let now = connection.releaseClock.now
        connection.attemptedAdds = connection.attemptedAdds.filter { $0.value > now }
        let saved = Set(scopedImportReceipts(for: connection).filter(\.isVaultAdd).map(\.completion.importId))
        var seen = Set<String>()
        connection.adds = queue.filter { request in
            connection.remaining(request) > 0
                && connection.attemptedAdds[request.id] == nil
                && !saved.contains(request.id)
                && (try? request.validate(for: connection.configuration.deviceID)) != nil
                && seen.insert(request.id).inserted
        }
        return connection.adds.reduce(false) { fresh, request in
            connection.remember("vault-add:\(request.id)", until: request.expiresAt, now: now) || fresh
        }
    }

    func reviewVaultAdd(_ request: VaultAddSummary, at connection: BrokerConnection) async -> VaultAddReview? {
        var review: VaultAddReview?
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            let context = try await authenticate("Review the login from \(connection.machine.title)")
            defer { context.invalidate() }
            try Task.checkCancellation()
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            let recipient = try importRecipient(context, at: connection)
            let account = try request.openAccount(origin: connection.configuration.origin, recipient: recipient)
            review = VaultAddReview(account: account, request: request, origin: connection.configuration.origin)
        }
        return review
    }

    func denyVaultAdd(_ request: VaultAddSummary, at connection: BrokerConnection) async -> Bool {
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            let api = try client(for: connection)
            _ = try await api.decideVaultAdd(.init(.deny, request: request), sign: signer(for: connection))
            connection.remove(request)
        }
    }

    func approveVaultAdd(
        _ request: VaultAddSummary, at connection: BrokerConnection, review: VaultAddReview
    ) async -> Bool {
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            guard review.isCurrent, review.request == request, review.origin == connection.configuration.origin else {
                throw VaultAddError.reviewExpired
            }
            try VaultContents.checkImportServices([request.service], existing: entries.map(\.service))
            let context = try await authenticate("Add this login to Harness Vault")
            defer { context.invalidate() }
            try Task.checkCancellation()
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            guard review.isCurrent else { throw VaultAddError.reviewExpired }
            let recipient = try importRecipient(context, at: connection)
            let api = try client(for: connection)
            let delivery = try await claimVaultAdd(request, at: connection, using: api)
            try Task.checkCancellation()
            guard review.isCurrent else { throw VaultAddError.reviewExpired }
            let origin = connection.configuration.origin
            let entry = try request.openLogin(delivery, reviewedAccount: review.account, origin: origin,
                recipient: recipient)
            let receipt = StoredImportReceipt(origin: origin, add: request, expiresAt: Date().addingTimeInterval(600))
            try vault.saveImport([entry], receipt: receipt, context: context)
            try loadEntries()
            await sendVaultAddReceipt(receipt, using: api, at: connection)
        }
    }

    private func claimVaultAdd(
        _ request: VaultAddSummary, at connection: BrokerConnection, using api: any DeviceBroker
    ) async throws -> VaultAddDelivery {
        connection.attemptedAdds[request.id] = request.expiresAt
        connection.remove(request)
        do {
            guard let claimed = try await api.decideVaultAdd(.init(.approve, request: request),
                                                            sign: signer(for: connection)) else {
                throw VaultAddError.invalidEnvelope
            }
            return claimed
        } catch BrokerError.routeProtected {
            connection.attemptedAdds.removeValue(forKey: request.id)
            throw BrokerError.routeProtected
        }
    }
}
