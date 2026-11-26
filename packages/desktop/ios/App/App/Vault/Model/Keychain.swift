import Foundation
import Security

enum DeviceVaultError: Error {
    case faceIDUnavailable
    case authentication
    case keychain(OSStatus)
    case missingKey
    case invalidConfiguration
    case missingEntry
    case duplicateBroker
    case duplicateBrokerDevice
    case serviceCodeRequired
    case duplicateService
}

struct Keychain {
    private let service = "com.dafuga.harness.vault.v1"

    func read(_ account: String) throws -> Data? {
        var query = attributes(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw DeviceVaultError.keychain(status)
        }
        return data
    }

    func write(_ data: Data, to account: String) throws {
        let query = attributes(account)
        let value = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, value as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
            let added = SecItemAdd(item as CFDictionary, nil)
            guard added == errSecSuccess else { throw DeviceVaultError.keychain(added) }
        } else if status != errSecSuccess {
            throw DeviceVaultError.keychain(status)
        }
    }

    private func attributes(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }
}
