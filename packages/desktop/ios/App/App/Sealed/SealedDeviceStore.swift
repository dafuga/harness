import CryptoKit
import Foundation
import LocalAuthentication
import Security

/// Where the opaque key blobs of a device are kept. The app's is the Keychain; a check hands in
/// its own, so no check writes to a real keychain.
protocol SealedSecretStore {
    func load(_ name: String) -> Data?
    func save(_ name: String, _ data: Data) throws
    func remove(_ name: String)
}

/// The Keychain of this device: not synchronised, readable after the first unlock so background
/// sync runs while the phone is locked.
struct SealedKeychain: SealedSecretStore {
    var insertOnly = false
    private let service = "com.dafuga.harness.sealed"

    private func query(_ name: String) -> [String: Any] {
        var result: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: name, kSecAttrSynchronizable as String: false
        ]
        #if os(macOS)
        result[kSecUseDataProtectionKeychain as String] = true
        #endif
        return result
    }

    func load(_ name: String) -> Data? {
        var request = query(name)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    func save(_ name: String, _ data: Data) throws {
        // An unavailable key must never be replaced by a newly generated login identity.
        if !insertOnly {
            let update = [kSecValueData as String: data]
            let status = SecItemUpdate(query(name) as CFDictionary, update as CFDictionary)
            if status == errSecSuccess { return }
            guard status == errSecItemNotFound else { throw SealedError("Keychain refused the update (\(status)).") }
        }
        var item = query(name)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw SealedError("Keychain refused the key (\(status)).") }
    }

    func remove(_ name: String) { SecItemDelete(query(name) as CFDictionary) }
}

/// Saves and restores a device's keys as one blob in a secret store.
enum SealedDeviceStore {
    static let name = "device-keys"

    private static func part(_ kind: String, _ data: Data) -> [String: String] {
        ["kind": kind, "data": RemoteCoding.base64url(data)]
    }

    static func save(_ device: SealedDevice, to store: SealedSecretStore) throws {
        let kem: [String: String]
        switch device.kem {
        case .software(let key): kem = part("software", key.rawRepresentation)
        case .enclave(let key): kem = part("enclave", key.dataRepresentation)
        }
        let signing: [String: String]
        switch device.signing {
        case .software(let key): signing = part("software", key.rawRepresentation)
        case .enclave(let key): signing = part("enclave", key.dataRepresentation)
        }
        let blob: [String: Any] = ["v": 1, "deviceId": device.deviceId, "kem": kem, "signing": signing]
        guard let data = RemoteCoding.json(blob) else { throw SealedError("Device keys could not be saved.") }
        try store.save(name, data)
    }

    static func load(from store: SealedSecretStore, context: LAContext? = nil) throws -> SealedDevice? {
        guard let data = store.load(name), let blob = RemoteCoding.object(data) else { return nil }
        guard let id = blob["deviceId"] as? String, let kem = blob["kem"] as? [String: String],
            let signing = blob["signing"] as? [String: String]
        else { throw SealedError("Stored device keys are malformed.") }
        return SealedDevice(
            deviceId: id, kem: try loadKem(kem, context), signing: try loadSigner(signing, context))
    }

    private static func bytes(_ part: [String: String]) throws -> Data {
        guard let data = part["data"].flatMap({ RemoteCoding.data(base64url: $0) }) else {
            throw SealedError("Stored device key is malformed.")
        }
        return data
    }

    private static func loadKem(_ part: [String: String], _ context: LAContext?) throws -> SealedKem {
        let data = try bytes(part)
        if part["kind"] == "enclave" {
            return .enclave(
                try SecureEnclave.P256.KeyAgreement.PrivateKey(
                    dataRepresentation: data, authenticationContext: context))
        }
        return .software(try P256.KeyAgreement.PrivateKey(rawRepresentation: data))
    }

    private static func loadSigner(_ part: [String: String], _ context: LAContext?) throws -> SealedSigner {
        let data = try bytes(part)
        if part["kind"] == "enclave" {
            return .enclave(
                try SecureEnclave.P256.Signing.PrivateKey(
                    dataRepresentation: data, authenticationContext: context))
        }
        return .software(try P256.Signing.PrivateKey(rawRepresentation: data))
    }
}
