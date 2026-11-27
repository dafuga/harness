import CryptoKit
import Foundation
import LocalAuthentication
import Security

/// A device's key-agreement key: in the Secure Enclave on iPhones and Apple Silicon Macs, or a
/// software key where there is none (a simulator, a check) and for the recovery device.
enum SealedKem {
    case software(P256.KeyAgreement.PrivateKey)
    case enclave(SecureEnclave.P256.KeyAgreement.PrivateKey)

    var publicKey: Data {
        switch self {
        case .software(let key): return key.publicKey.x963Representation
        case .enclave(let key): return key.publicKey.x963Representation
        }
    }

    var isEnclave: Bool { if case .enclave = self { return true } else { return false } }
}

/// A device's signing key, kept like `SealedKem`. Signatures are raw `r‖s`.
enum SealedSigner {
    case software(P256.Signing.PrivateKey)
    case enclave(SecureEnclave.P256.Signing.PrivateKey)

    var publicKey: Data {
        switch self {
        case .software(let key): return key.publicKey.x963Representation
        case .enclave(let key): return key.publicKey.x963Representation
        }
    }

    func sign(_ message: Data) throws -> Data {
        switch self {
        case .software(let key): return try key.signature(for: message).rawRepresentation
        case .enclave(let key): return try key.signature(for: message).rawRepresentation
        }
    }
}

/// The two key pairs of a device and its id. Private halves never leave their key objects; an
/// enclave key is only a device-bound blob that nothing else can use.
struct SealedDevice {
    let deviceId: String
    let kem: SealedKem
    let signing: SealedSigner

    var kemPublic: Data { kem.publicKey }
    var signingPublic: Data { signing.publicKey }

    /// New keys. `enclave: true` uses the Secure Enclave and fails where there is none;
    /// `userPresence` makes every signature (an approval) ask for Face ID, Touch ID or the passcode.
    static func create(
        enclave: Bool, userPresence: Bool = false, context: LAContext? = nil
    ) throws -> SealedDevice {
        let id = RemoteCoding.base64url(RemoteCoding.random(16))
        guard enclave else {
            return SealedDevice(
                deviceId: id, kem: .software(P256.KeyAgreement.PrivateKey()),
                signing: .software(P256.Signing.PrivateKey()))
        }
        return SealedDevice(
            deviceId: id,
            kem: .enclave(
                try SecureEnclave.P256.KeyAgreement.PrivateKey(
                    accessControl: access(presence: false), authenticationContext: context)),
            signing: .enclave(
                try SecureEnclave.P256.Signing.PrivateKey(
                    accessControl: access(presence: userPresence), authenticationContext: context)))
    }

    private static func access(presence: Bool) throws -> SecAccessControl {
        let flags: SecAccessControlCreateFlags = presence ? [.privateKeyUsage, .userPresence] : .privateKeyUsage
        var error: Unmanaged<CFError>?
        guard let control = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, flags, &error)
        else { throw SealedError("Access control could not be made: \(String(describing: error))") }
        return control
    }

    /// Signs a chain entry as this device; `by` is set to this device's id.
    func sign(_ entry: SealedChainEntry) throws -> SealedChainEntry {
        var signed = entry
        signed.by = deviceId
        signed.sig = RemoteCoding.base64url(try signing.sign(signed.signedBytes))
        return signed
    }
}
