import Foundation
import Security

/// Where a pairing is kept. The app's is the Keychain; a check hands in its own, so that no
/// check ever writes to a real keychain.
protocol RemoteVault {
    func load() -> RemoteRecord?
    func save(_ record: RemoteRecord) throws
    func wipe()
}

/// The only place a credential or a private key is kept: the Keychain of this device. Nothing
/// is synchronised, and an item is readable after the first unlock so a locked phone reconnects.
struct RemoteKeychain: RemoteVault {
    private let service = "com.dafuga.harness.remote"
    private let account = "pairing"

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false
        ]
    }

    func load() -> RemoteRecord? {
        var query = self.query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
            let data = item as? Data
        else { return nil }
        return try? JSONDecoder().decode(RemoteRecord.self, from: data)
    }

    func save(_ record: RemoteRecord) throws {
        guard let data = try? JSONEncoder().encode(record) else {
            throw RemoteFailure.failed("This phone could not keep the pairing.")
        }
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw RemoteFailure.failed(
                "This phone could not keep the pairing in its Keychain (\(status)). Remove this phone in Harness on your computer, then pair again.")
        }
    }

    func wipe() {
        SecItemDelete(query as CFDictionary)
    }
}
