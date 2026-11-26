import Foundation

extension VaultModel {
    func retryVaultAddReceipt(using api: any DeviceBroker, at connection: BrokerConnection) async {
        guard let receipt = scopedImportReceipts(for: connection)
            .first(where: { $0.isVaultAdd && !$0.confirmed && $0.expiresAt > .now }) else { return }
        await sendVaultAddReceipt(receipt, using: api, at: connection)
    }

    func sendVaultAddReceipt(
        _ receipt: StoredImportReceipt, using api: any DeviceBroker, at connection: BrokerConnection
    ) async {
        do {
            _ = try await api.decideVaultAdd(.init(stored: receipt.completion.importId,
                                                  digest: receipt.completion.ciphertextSha256),
                                             sign: signer(for: connection))
            try vault.confirmImport(receipt)
            importReceipts = try vault.importReceipts()
        } catch {
            // The atomic Keychain save keeps the receipt for an idempotent retry.
        }
    }
}
