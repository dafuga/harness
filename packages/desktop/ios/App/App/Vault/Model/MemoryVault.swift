#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation
import LocalAuthentication

final class MemoryVault: VaultStorage {
    static let password = "synthetic-ui-fixture"
    private var journal = VaultContents()
    private let storageKey = P256.KeyAgreement.PrivateKey()
    private var records: [VaultEntry]

    init(empty: Bool) {
        records = empty ? [] : [VaultEntry(service: "Demo registry", username: "demo", password: Self.password)]
    }

    func labels() throws -> [EntryLabel] {
        records.map {
            EntryLabel(id: $0.id, service: $0.service, twoFactorEveryTime: $0.twoFactorEveryTime,
                       username: $0.username, domain: $0.domain)
        }
    }

    func read(_ id: UUID, context: LAContext) throws -> VaultEntry {
        guard let entry = records.first(where: { $0.id == id }) else { throw DeviceVaultError.missingEntry }
        return entry
    }

    func save(_ entry: VaultEntry, context: LAContext) throws {
        try entry.validate()
        records.removeAll { $0.id == entry.id }
        records.append(entry)
    }

    func delete(_ id: UUID) throws {
        records.removeAll { $0.id == id }
    }

    func importReceipts() throws -> [StoredImportReceipt] { journal.importReceipts }

    func saveImport(_ entries: [VaultEntry], receipt: StoredImportReceipt, context: LAContext) throws {
        try VaultContents.checkImportServices(entries.map(\.service), existing: records.map(\.service))
        if try journal.appendImport(entries, receipt: receipt, seal: {
            try VaultCiphertext.seal($0, to: storageKey.publicKey)
        }) {
            records.append(contentsOf: entries)
        }
    }

    func confirmImport(_ receipt: StoredImportReceipt) throws { journal.confirmImport(receipt) }

    func export(context: LAContext) throws -> [VaultEntry] { records }
    func previousRestore(from source: String) throws -> VaultBackup.Receipt? { nil }
    func restore(_ entries: [VaultEntry], receipt: VaultBackup.Receipt, source: String, context: LAContext) throws {
        records = entries
    }
}
#endif
