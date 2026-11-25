import Foundation
import Security

// A dedicated executor Keychain must already be unlocked. Never prompt for an existing secret.
func storePassword() -> Bool {
    guard CommandLine.arguments.count == 4,
          SecKeychainSetUserInteractionAllowed(false) == errSecSuccess else { return false }
    let path = CommandLine.arguments[1]
    let service = CommandLine.arguments[2]
    let account = CommandLine.arguments[3]
    var destination: SecKeychain?
    guard SecKeychainOpen(path, &destination) == errSecSuccess, let keychain = destination,
          var password = try? FileHandle.standardInput.read(upToCount: 37), password.count == 36 else { return false }
    defer { password.resetBytes(in: password.startIndex..<password.endIndex) }

    let record: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account
    ]
    var add = record
    add[kSecUseKeychain as String] = keychain
    add[kSecValueData as String] = password
    guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { return false }

    var read = record
    read[kSecMatchSearchList as String] = [keychain]
    read[kSecReturnData as String] = true
    var result: CFTypeRef?
    guard SecItemCopyMatching(read as CFDictionary, &result) == errSecSuccess,
          var saved = result as? Data else { return false }
    defer { saved.resetBytes(in: saved.startIndex..<saved.endIndex) }
    return saved == password
}

exit(storePassword() ? 0 : 1)
