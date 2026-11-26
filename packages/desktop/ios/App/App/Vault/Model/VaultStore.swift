import CryptoKit
import Foundation
import LocalAuthentication

struct EntryLabel: Identifiable, Equatable {
    let id: UUID
    let service: String
    let twoFactorEveryTime: Bool
}

@MainActor
protocol VaultStorage {
    func labels() throws -> [EntryLabel]
    func read(_ id: UUID, context: LAContext) throws -> VaultEntry
    func save(_ entry: VaultEntry, context: LAContext) throws
    func delete(_ id: UUID) throws
    func importReceipts() throws -> [StoredImportReceipt]
    func saveImport(_ entries: [VaultEntry], receipt: StoredImportReceipt, context: LAContext) throws
    func confirmImport(_ receipt: StoredImportReceipt) throws
    func export(context: LAContext) throws -> [VaultEntry]
    func previousRestore(from source: String) throws -> VaultBackup.Receipt?
    func restore(_ entries: [VaultEntry], receipt: VaultBackup.Receipt, source: String, context: LAContext) throws
}

@MainActor
struct VaultStore: VaultStorage {
    let keychain: Keychain
    let keys: DeviceKeys
    private let account = "encrypted-vault"

    func labels() throws -> [EntryLabel] {
        try storedVault().entries.map {
            EntryLabel(id: $0.id, service: $0.service, twoFactorEveryTime: $0.twoFactorEveryTime)
        }
    }

    func read(_ id: UUID, context: LAContext) throws -> VaultEntry {
        guard let record = try storedVault().entries.first(where: { $0.id == id }) else {
            throw DeviceVaultError.missingEntry
        }
        let key = try keys.agreement(.vault, context: context)
        return try record.open { try key.sharedSecretFromKeyAgreement(with: $0) }
    }

    func save(_ entry: VaultEntry, context: LAContext) throws {
        var vault = try storedVault()
        guard !vault.entries.contains(where: { $0.id != entry.id && $0.service == entry.service }) else {
            throw DeviceVaultError.duplicateService
        }
        let key = try keys.agreementPublicKey(.vault, context: context, create: vault.entries.isEmpty)
        let record = try VaultCiphertext.seal(entry, to: key)
        vault.entries.removeAll { $0.id == entry.id }
        vault.entries.append(record)
        try store(vault)
    }

    func delete(_ id: UUID) throws {
        var vault = try storedVault()
        vault.entries.removeAll { $0.id == id }
        try store(vault)
    }

    func importReceipts() throws -> [StoredImportReceipt] {
        try storedVault().importReceipts
    }

    func saveImport(_ entries: [VaultEntry], receipt: StoredImportReceipt, context: LAContext) throws {
        var vault = try storedVault()
        let key = try keys.agreementPublicKey(.vault, context: context, create: vault.entries.isEmpty)
        if try vault.appendImport(entries, receipt: receipt, seal: { try VaultCiphertext.seal($0, to: key) }) {
            try store(vault)
        }
    }

    func confirmImport(_ receipt: StoredImportReceipt) throws {
        var vault = try storedVault()
        if vault.confirmImport(receipt) { try store(vault) }
    }

    func export(context: LAContext) throws -> [VaultEntry] {
        let entries = try storedVault().entries
        guard !entries.isEmpty else { return [] }
        let key = try keys.agreement(.vault, context: context)
        return try entries.map { record in
            try record.open { try key.sharedSecretFromKeyAgreement(with: $0) }
        }
    }

    func previousRestore(from source: String) throws -> VaultBackup.Receipt? {
        try storedVault().restorations[source]
    }

    func restore(_ entries: [VaultEntry], receipt: VaultBackup.Receipt, source: String, context: LAContext) throws {
        var vault = try storedVault()
        let key = try keys.agreementPublicKey(.vault, context: context, create: vault.entries.isEmpty)
        guard Set(entries.map(\.service)).count == entries.count else { throw BackupError.invalid }
        vault.entries = try entries.map { try VaultCiphertext.seal($0, to: key) }
        vault.restorations[source] = receipt
        try store(vault)
    }

    private func storedVault() throws -> VaultContents {
        guard let data = try keychain.read(account) else { return VaultContents() }
        return try JSONDecoder().decode(VaultContents.self, from: data)
    }

    private func store(_ vault: VaultContents) throws {
        try keychain.write(JSONEncoder().encode(vault), to: account)
    }
}
