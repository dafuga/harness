import CryptoKit
import Foundation
import LocalAuthentication
import Security

@available(iOS 17.0, *)
@MainActor
struct DeviceKeys {
    enum Agreement: String {
        case vault = "entry-agreement-key"
        case backup = "backup-agreement-key"
        case passwordImport = "import-agreement-key"
    }

    let keychain: Keychain

    func authenticate(_ reason: String) async throws -> LAContext {
        let context = LAContext()
        context.localizedFallbackTitle = ""
        context.touchIDAuthenticationAllowableReuseDuration = 0
        let nativeMac = ProcessInfo.processInfo.isiOSAppOnMac || ProcessInfo.processInfo.isMacCatalystApp
        guard SecureEnclave.isAvailable,
              context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil),
              context.biometryType == (nativeMac ? .touchID : .faceID) else {
            throw DeviceVaultError.faceIDUnavailable
        }
        guard try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) else {
            throw DeviceVaultError.authentication
        }
        return context
    }

    func agreement(
        _ purpose: Agreement, context: LAContext, at connection: BrokerConnection? = nil
    ) throws -> SecureEnclave.P256.KeyAgreement.PrivateKey {
        let account = connection?.keyAccount(purpose.rawValue) ?? purpose.rawValue
        guard let blob = try keychain.read(account) else { throw DeviceVaultError.missingKey }
        return try SecureEnclave.P256.KeyAgreement.PrivateKey(dataRepresentation: blob, authenticationContext: context)
    }

    func agreementPublicKey(
        _ purpose: Agreement, context: LAContext, create: Bool, at connection: BrokerConnection? = nil
    ) throws -> P256.KeyAgreement.PublicKey {
        let account = connection?.keyAccount(purpose.rawValue) ?? purpose.rawValue
        if try keychain.read(account) != nil {
            return try agreement(purpose, context: context, at: connection).publicKey
        }
        guard create else { throw DeviceVaultError.missingKey }
        let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(
            accessControl: accessControl([.privateKeyUsage, .biometryCurrentSet]),
            authenticationContext: context
        )
        try keychain.write(key.dataRepresentation, to: account)
        return key.publicKey
    }

    func signingKey(for connection: BrokerConnection, create: Bool = false) throws
        -> SecureEnclave.P256.Signing.PrivateKey {
        let account = connection.keyAccount("device-signing-key")
        if let blob = try keychain.read(account) {
            return try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
        }
        guard create else { throw DeviceVaultError.missingKey }
        // The protocol authenticates every poll with this same device key. Decisions have a separate fresh biometric gate.
        let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: accessControl(.privateKeyUsage))
        try keychain.write(key.dataRepresentation, to: account)
        return key
    }

    private func accessControl(_ flags: SecAccessControlCreateFlags) throws -> SecAccessControl {
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, flags, &error
        ) else {
            if let error { throw error.takeRetainedValue() }
            throw DeviceVaultError.authentication
        }
        return access
    }
}
