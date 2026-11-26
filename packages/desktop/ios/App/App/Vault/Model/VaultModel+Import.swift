import CryptoKit
import Foundation
import LocalAuthentication

extension VaultModel {
    func scopedImportReceipts(for connection: BrokerConnection) -> [StoredImportReceipt] {
        importReceipts.filter {
            $0.matches(origin: connection.configuration.origin, deviceID: connection.configuration.deviceID)
        }
    }

    func decideImport(
        _ request: ReviewedPasswordImport, at connection: BrokerConnection, choice: PasswordImportDecision.Choice
    ) async -> Bool {
        await perform(at: connection) {
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            if choice == .approve {
                try VaultContents.checkImportServices(request.services.map(\.service), existing: entries.map(\.service))
            }
            let reason = choice == .approve ? "Import these passwords into the vault" : "Discard this password import"
            let context = try await authenticate(reason)
            defer { context.invalidate() }
            guard isCurrent(connection), connection.live(request) else { throw BrokerError.expired }
            let api = try client(for: connection)
            let decision = PasswordImportDecision(choice, request: request)
            switch choice {
            case .deny:
                _ = try await api.decideImport(decision, sign: signer(for: connection))
                connection.remove(request)
            case .approve:
                try await claimImport(request, at: connection, decision: decision, in: .init(api: api, context: context))
            }
        }
    }

    private func claimImport(
        _ request: ReviewedPasswordImport, at connection: BrokerConnection, decision: PasswordImportDecision,
        in session: ImportSession
    ) async throws {
        let (api, context) = (session.api, session.context)
        let recipient = try importRecipient(context, at: connection)
        try request.verifyRecipient(recipient.publicKey)
        connection.attemptedImports[request.id] = request.expiresAt
        connection.remove(request)
        let delivery: PasswordImportDelivery
        do {
            guard let claimed = try await api.decideImport(decision, sign: signer(for: connection)) else {
                throw PasswordImportError.invalidBundle
            }
            delivery = claimed
        } catch BrokerError.http(409) {
            throw BrokerError.expired
        } catch BrokerError.routeProtected {
            // The transport gate answered before the broker could consume the request.
            connection.attemptedImports.removeValue(forKey: request.id)
            throw BrokerError.routeProtected
        } catch {
            if PollFailure(error).isOffline { throw error }
            throw PasswordImportError.deliveryInterrupted
        }
        let receipt = StoredImportReceipt(
            origin: connection.configuration.origin, request: request, expiresAt: Date().addingTimeInterval(600)
        )
        try saveOpenedImport(delivery, for: .init(request: request, receipt: receipt), to: recipient, context: context)
        try loadEntries()
        await sendImportReceipt(receipt, using: api, at: connection)
    }

    private func saveOpenedImport(
        _ delivery: PasswordImportDelivery, for claim: ClaimedImport,
        to recipient: VaultRecipient, context: LAContext
    ) throws {
        let receipt = claim.receipt
        let entries = try delivery.open(
            request: claim.request, origin: receipt.origin,
            recipient: recipient.publicKey, agreement: recipient.agree
        )
        try vault.saveImport(entries, receipt: receipt, context: context)
    }

    func retryImportReceipt(using api: any DeviceBroker, at connection: BrokerConnection) async {
        guard let receipt = scopedImportReceipts(for: connection).first(where: { !$0.isVaultAdd && !$0.confirmed && $0.expiresAt > .now }) else { return }
        await sendImportReceipt(receipt, using: api, at: connection)
    }

    private func sendImportReceipt(
        _ receipt: StoredImportReceipt, using api: any DeviceBroker, at connection: BrokerConnection
    ) async {
        do {
            try await api.completeImport(receipt.completion, sign: signer(for: connection))
            try vault.confirmImport(receipt)
            importReceipts = try vault.importReceipts()
        } catch {
            // The Keychain receipt remains pending for an idempotent retry on the next successful poll.
        }
    }

    func importRecipient(_ context: LAContext, at connection: BrokerConnection) throws -> VaultRecipient {
        #if DEBUG && targetEnvironment(simulator)
        if let key = (connection.fixture as? FixtureBroker)?.importKey {
            return VaultRecipient(publicKey: key.publicKey, agree: key.sharedSecretFromKeyAgreement)
        }
        #endif
        let key = try keys.agreement(.passwordImport, context: context, at: connection)
        return VaultRecipient(publicKey: key.publicKey, agree: key.sharedSecretFromKeyAgreement)
    }
}

private struct ImportSession {
    let api: any DeviceBroker
    let context: LAContext
}

private struct ClaimedImport {
    let request: ReviewedPasswordImport
    let receipt: StoredImportReceipt
}
