import Foundation
import Security

func fixtureKeychain() -> Bool {
    guard CommandLine.arguments.count == 3,
          SecKeychainSetUserInteractionAllowed(false) == errSecSuccess else { return false }
    let path = CommandLine.arguments[1]
    let action = CommandLine.arguments[2]
    var keychain: SecKeychain?
    if action == "create" {
        let password = UUID().uuidString
        return SecKeychainCreate(path, UInt32(password.utf8.count), password, false, nil, &keychain) == errSecSuccess
    }
    guard SecKeychainOpen(path, &keychain) == errSecSuccess, let keychain = keychain else { return false }
    if action == "delete" { return SecKeychainDelete(keychain) == errSecSuccess }
    if action != "verify" { return false }
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecMatchSearchList as String: [keychain],
        kSecAttrService as String: "org.harness.vault.password/harness/synthetic/example-console/synthetic-owner",
        kSecAttrAccount as String: "owner@example.test",
        kSecReturnAttributes as String: true
    ]
    return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
}

exit(fixtureKeychain() ? 0 : 1)
