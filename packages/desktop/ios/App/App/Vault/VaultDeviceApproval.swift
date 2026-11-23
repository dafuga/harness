import CryptoKit
import Foundation
import LocalAuthentication
import Security

/// The public identity belongs to one enrolled broker origin and device ID. Only native code can
/// ask the Secure Enclave to use the private half.
struct VaultDeviceApproval {
    enum Failure: Error { case keychain }

    struct Scope: Encodable {
        let origin: String
        let deviceId: String
    }

    private typealias DeviceKey = SecureEnclave.P256.Signing.PrivateKey
    let scope: Scope

    func enroll() async throws -> String {
        guard SecureEnclave.isAvailable else { throw Failure.keychain }
        let context = try await VaultFaceID.authenticate("Enroll this iPhone for Harness Vault approvals")
        defer { context.invalidate() }
        let query = try keyQuery()
        if let old = try key(query, context: context) {
            return RemoteCoding.base64url(old.publicKey.x963Representation)
        }
        guard let control = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, [.privateKeyUsage, .biometryCurrentSet], nil)
        else { throw Failure.keychain }
        let created = try DeviceKey(accessControl: control, authenticationContext: context)
        var item = query
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
        item[kSecValueData as String] = created.dataRepresentation
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem,
            let enrolled = try key(query, context: context)
        else { throw Failure.keychain }
        return RemoteCoding.base64url(enrolled.publicKey.x963Representation)
    }

    func queue(_ challenge: VaultDeviceChallenge) async throws -> VaultDeviceProof {
        try check(challenge)
        let context = try await VaultFaceID.authenticate("Open the Harness Vault request inbox")
        defer { context.invalidate() }
        let signer = try enrolled(context)
        return try VaultApprovalCrypto.queue(challenge, now: now) { try signer.signature(for: $0).rawRepresentation }
    }

    func decide(
        _ request: VaultApprovalRequest, challenge: VaultDeviceChallenge,
        intent: (LAContext) throws -> VaultApprovalIntent
    ) async throws -> VaultDeviceProof {
        try check(challenge)
        _ = try request.recipient(now: now)
        let context = try await VaultFaceID.authenticate("Confirm this reviewed Harness Vault decision")
        defer { context.invalidate() }
        let signer = try enrolled(context)
        try check(challenge)
        _ = try request.recipient(now: now)
        return try VaultApprovalCrypto.decision(request, intent: intent(context), at: challenge) {
            try signer.signature(for: $0).rawRepresentation
        }
    }

    private var now: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    private func check(_ challenge: VaultDeviceChallenge) throws {
        guard scope.origin == challenge.origin, scope.deviceId == challenge.deviceId else {
            throw VaultApprovalFailure.binding
        }
        guard now < challenge.expiresAt else { throw VaultApprovalFailure.expired }
    }

    private func enrolled(_ context: LAContext) throws -> DeviceKey {
        guard let loaded = try key(keyQuery(), context: context) else { throw Failure.keychain }
        return loaded
    }

    private func keyQuery() throws -> [String: Any] {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let account = RemoteCoding.hex(RemoteCoding.sha256(try encoder.encode(scope)))
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.dafuga.harness.vault.approval.v1",
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false
        ]
    }

    private func key(_ query: [String: Any], context: LAContext) throws -> DeviceKey? {
        var read = query
        read[kSecMatchLimit as String] = kSecMatchLimitOne
        read[kSecReturnData as String] = true
        var stored: CFTypeRef?
        let status = SecItemCopyMatching(read as CFDictionary, &stored)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let bytes = stored as? Data else { throw Failure.keychain }
        return try DeviceKey(dataRepresentation: bytes, authenticationContext: context)
    }
}
