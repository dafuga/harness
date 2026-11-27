import CryptoKit
import Foundation

/// The recovery device's private keys, sealed under a 32-byte secret Daniel keeps in the
/// Credential Vault: base64url(salt 16 ‖ nonce 12 ‖ AES-256-GCM), the salt authenticated.
/// Opening it gives software keys: the new device then acts as the recovery device.
enum SealedRecovery {
    static func newSecret() -> Data { RemoteCoding.random(32) }

    private static func key(_ secret: Data, salt: Data) throws -> SymmetricKey {
        guard secret.count == 32 else { throw SealedError("Recovery secret must be 32 bytes.") }
        return SealedBytes.derive(SealedBytes.key(secret), salt: salt, info: "harness/sealed/v1/recovery")
    }

    private static func material(_ device: SealedDevice) throws -> Data {
        guard case .software(let kem) = device.kem, case .software(let signing) = device.signing else {
            throw SealedError("Recovery device keys must be extractable.")
        }
        let fields: [String: Any] = [
            "deviceId": device.deviceId, "kemD": RemoteCoding.base64url(kem.rawRepresentation),
            "signingD": RemoteCoding.base64url(signing.rawRepresentation),
            "kemPublic": RemoteCoding.base64url(device.kemPublic),
            "signingPublic": RemoteCoding.base64url(device.signingPublic)
        ]
        guard let json = RemoteCoding.json(fields) else { throw SealedError("Recovery keys could not be encoded.") }
        return json
    }

    static func seal(
        _ device: SealedDevice, secret: Data, salt: Data = RemoteCoding.random(16),
        nonce: Data = RemoteCoding.random(12)
    ) throws -> String {
        let sealed = try SealedBytes.seal(
            try material(device), key: try key(secret, salt: salt), nonce: nonce, aad: salt)
        return RemoteCoding.base64url(salt + nonce + sealed)
    }

    /// A wrong secret or a changed blob throws.
    static func open(_ blob: String, secret: Data) throws -> SealedDevice {
        guard let bytes = RemoteCoding.data(base64url: blob), bytes.count > 44 else {
            throw SealedError("Recovery blob is malformed.")
        }
        let salt = bytes.prefix(16), nonce = bytes.dropFirst(16).prefix(12)
        guard let plain = try? SealedBytes.open(
            Data(bytes.dropFirst(28)), key: try key(secret, salt: Data(salt)), nonce: Data(nonce),
            aad: Data(salt)), let fields = RemoteCoding.object(plain)
        else { throw SealedError("Recovery secret does not open this blob.") }
        guard let id = fields["deviceId"] as? String,
            let kemD = (fields["kemD"] as? String).flatMap({ RemoteCoding.data(base64url: $0) }),
            let signingD = (fields["signingD"] as? String).flatMap({ RemoteCoding.data(base64url: $0) })
        else { throw SealedError("Recovery blob is malformed.") }
        return SealedDevice(
            deviceId: id, kem: .software(try P256.KeyAgreement.PrivateKey(rawRepresentation: kemD)),
            signing: .software(try P256.Signing.PrivateKey(rawRepresentation: signingD)))
    }
}
