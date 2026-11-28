import Foundation
import Security

/// Where the Hub session is kept. The app's is the Keychain; a check hands in its own, so that
/// no check ever writes to a real keychain.
protocol HubAccountVault {
    func load() -> HubAccountCredential?
    func save(_ credential: HubAccountCredential) throws
    func wipe()
}

/// The Keychain item of the Hub session: a service of its own, apart from any pairing, never
/// synchronised to another device or to iCloud, and readable on this device after its first
/// unlock only.
private struct HubAccountKeychainItem: HubAccountVault {
    private let service = "com.dafuga.harness.hub"
    private let account = "session"

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false
        ]
    }

    func load() -> HubAccountCredential? {
        var query = self.query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
            let data = item as? Data
        else { return nil }
        return try? JSONDecoder().decode(HubAccountCredential.self, from: data)
    }

    func save(_ credential: HubAccountCredential) throws {
        guard let data = try? JSONEncoder().encode(credential) else { throw HubAccountFailure.unkept }
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw HubAccountFailure.unkept }
    }

    func wipe() {
        SecItemDelete(query as CFDictionary)
    }
}

/// The session vault used by every foreground and background account reader.
struct HubAccountKeychain: HubAccountVault {
    private let item: HubAccountVault
    private let directory: URL

    init(item: HubAccountVault? = nil, directory: URL? = nil) {
        self.item = item ?? HubAccountKeychainItem()
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("HarnessAccount", isDirectory: true)
    }

    private var marker: URL { directory.appendingPathComponent("session-binding") }

    func load() -> HubAccountCredential? {
        guard let credential = item.load(), let binding = credential.installationBinding,
            let stored = try? Data(contentsOf: marker), stored == Data(binding.uuidString.utf8)
        else { return nil }
        return credential
    }

    func save(_ credential: HubAccountCredential) throws {
        // A Keychain item can survive uninstall. Keep its matching marker in the app container,
        // excluded from backups. Only a newly issued session can create the binding.
        var folder = directory
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var properties = URLResourceValues()
        properties.isExcludedFromBackup = true
        try folder.setResourceValues(properties)
        let binding = UUID()
        var bound = credential
        bound.installationBinding = binding
        try Data(binding.uuidString.utf8).write(to: marker, options: .atomic)
        try item.save(bound)
    }

    func wipe() {
        try? FileManager.default.removeItem(at: marker)
        item.wipe()
    }
}
