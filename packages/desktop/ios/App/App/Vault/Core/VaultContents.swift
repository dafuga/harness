import CryptoKit
import Foundation

public struct StoredImportReceipt: Codable, Equatable, Sendable {
    public let origin: String
    public let deviceID: String
    public let completion: PasswordImportCompletion
    public let count: Int
    public let expiresAt: Date
    private var vaultAdd: Bool?
    public var isVaultAdd: Bool { vaultAdd == true }
    public var confirmed = false

    public init(origin: String, request: ReviewedPasswordImport, expiresAt: Date) {
        self.origin = origin
        deviceID = request.summary.recipientDeviceId
        completion = PasswordImportCompletion(request: request)
        count = request.services.count
        self.expiresAt = expiresAt
    }

    public init(origin: String, add: VaultAddSummary, expiresAt: Date) {
        self.origin = origin
        deviceID = add.recipientDeviceId
        completion = PasswordImportCompletion(importId: add.id, digest: add.payloadSha256)
        count = 1
        self.expiresAt = expiresAt
        vaultAdd = true
    }

    public func matches(origin: String, deviceID: String) -> Bool {
        self.origin == origin && self.deviceID == deviceID
    }

    fileprivate func isSameImport(as other: Self) -> Bool {
        isVaultAdd == other.isVaultAdd && matches(origin: other.origin, deviceID: other.deviceID)
            && completion.importId == other.completion.importId
    }
}

public struct VaultContents: Codable, Sendable {
    public var entries: [VaultCiphertext] = []
    public var restorations: [String: VaultBackup.Receipt] = [:]
    private var importJournal: [StoredImportReceipt]?

    public init() {}

    public var importReceipts: [StoredImportReceipt] { importJournal ?? [] }

    public static func checkImportServices(_ services: [String], existing: [String]) throws {
        let names = Set(services.map { $0.lowercased() })
        guard names.count == services.count,
              names.isDisjoint(with: existing.map { $0.lowercased() }) else {
            throw PasswordImportError.serviceConflict
        }
    }

    @discardableResult
    public mutating func appendImport(
        _ batch: [VaultEntry], receipt: StoredImportReceipt, seal: (VaultEntry) throws -> VaultCiphertext
    ) throws -> Bool {
        if let previous = importReceipts.first(where: { $0.isSameImport(as: receipt) }) {
            guard previous.completion == receipt.completion else { throw PasswordImportError.invalidBundle }
            return false
        }
        guard batch.count == receipt.count, !batch.isEmpty else { throw PasswordImportError.invalidBundle }
        try Self.checkImportServices(batch.map(\.service), existing: entries.map(\.service))
        let encrypted = try batch.map(seal)
        entries.append(contentsOf: encrypted)
        importJournal = importReceipts + [receipt]
        return true
    }

    @discardableResult
    public mutating func confirmImport(_ receipt: StoredImportReceipt) -> Bool {
        guard let index = importJournal?.firstIndex(where: { $0.isSameImport(as: receipt) }),
              importJournal?[index].completion == receipt.completion,
              importJournal?[index].confirmed == false else { return false }
        importJournal?[index].confirmed = true
        return true
    }
}
