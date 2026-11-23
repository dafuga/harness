import Foundation
import LocalAuthentication
import Security

/// The app calls this after the user reviews the native preview. Its receipt carries only the add ID.
enum VaultLegacyImportKeychain {
    static func preview(
        _ offer: VaultLegacyImportReview.Offer, to recipient: VaultLegacyAdd.Recipient
    ) async throws -> VaultLegacyImportReview {
        try requireCurrent(offer.binding.expiresAt)
        let context = try await VaultFaceID.authenticate("Review the account for this Harness Vault import")
        defer { context.invalidate() }
        return try VaultLegacyImportReview(offer, to: recipient, now: now)
    }

    static func confirm(
        _ review: VaultLegacyImportReview, login: VaultLegacyAdd.Box, to recipient: VaultLegacyAdd.Recipient
    ) async throws -> String {
        try requireCurrent(review.expiresAt)
        let context = try await VaultFaceID.authenticate("Save the reviewed login in Harness Vault")
        defer { context.invalidate() }
        return try review.save(login, to: recipient, now: now) { entry in
            try saveAndReopen(entry, context: context)
        }
    }

    private static var now: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    private static func requireCurrent(_ expiresAt: Int64) throws {
        guard now < expiresAt else { throw VaultApprovalFailure.expired }
    }

    private static func saveAndReopen(_ entry: VaultImportedLogin, context: LAContext) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let identity = try encoder.encode(entry.identity)
        let account = RemoteCoding.hex(RemoteCoding.sha256(identity))
        var bytes = try encoder.encode(entry)
        defer { bytes.resetBytes(in: bytes.startIndex..<bytes.endIndex) }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.dafuga.harness.vault.login.v1",
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
            kSecUseAuthenticationContext as String: context
        ]
        let result = try insert(bytes, matching: query)
        var reopened = try reopen(query)
        defer { reopened.resetBytes(in: reopened.startIndex..<reopened.endIndex) }
        guard reopened == bytes else { throw result == errSecDuplicateItem ? VaultImportFailure.conflict : .storage }
    }

    private static func insert(_ bytes: Data, matching query: [String: Any]) throws -> OSStatus {
        guard let control = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, nil)
        else { throw VaultImportFailure.storage }
        var item = query
        item[kSecAttrAccessControl as String] = control
        item[kSecValueData as String] = bytes
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else { throw VaultImportFailure.storage }
        return status
    }

    private static func reopen(_ query: [String: Any]) throws -> Data {
        var read = query
        read[kSecReturnData as String] = true
        read[kSecMatchLimit as String] = kSecMatchLimitOne
        var stored: CFTypeRef?
        guard SecItemCopyMatching(read as CFDictionary, &stored) == errSecSuccess, let bytes = stored as? Data else {
            throw VaultImportFailure.storage
        }
        return bytes
    }
}
