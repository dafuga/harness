import CryptoKit
import Foundation

/// A scope key bundle wrapped for one device. `enc` and `ct` are base64url.
struct SealedGrant: Equatable {
    let account: String
    let scope: String
    let epoch: UInt32
    let device: String
    let enc: String
    let ct: String
}

/// Grants are HPKE (RFC 9180) base mode, DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
/// over `dataKey ‖ indexKey`, with an info string that binds one recipient. CryptoKit does the
/// key agreement inside the Secure Enclave, so the device key is never read.
@available(iOS 17.0, macOS 14.0, *)
enum SealedGrantCrypto {
    static let suite = HPKE.Ciphersuite(kem: .P256_HKDF_SHA256, kdf: .HKDF_SHA256, aead: .AES_GCM_256)

    /// Label ‖ canonical `{account, device, epoch, scope}`.
    static func info(account: String, scope: String, epoch: UInt32, device: String) -> Data {
        let context = SealedJson.object([
            "account": .string(account), "device": .string(device), "epoch": .int(Int64(epoch)),
            "scope": .string(scope)
        ])
        return SealedBytes.text("harness/sealed/v1/grant\0" + context.canonical)
    }

    private static func info(_ grant: SealedGrant) -> Data {
        info(account: grant.account, scope: grant.scope, epoch: grant.epoch, device: grant.device)
    }

    /// Wraps scope key bytes for the device that owns `recipientPublic` (an uncompressed point).
    static func wrap(
        account: String, raw: SealedRawScopeKeys, deviceId: String, recipientPublic: Data
    ) throws -> SealedGrant {
        let scope = RemoteCoding.base64url(raw.scopeId)
        let recipient = try P256.KeyAgreement.PublicKey(x963Representation: recipientPublic)
        var sender = try HPKE.Sender(
            recipientKey: recipient, ciphersuite: suite,
            info: info(account: account, scope: scope, epoch: raw.epoch, device: deviceId))
        let sealed = try sender.seal(raw.dataKey + raw.indexKey)
        return SealedGrant(
            account: account, scope: scope, epoch: raw.epoch, device: deviceId,
            enc: RemoteCoding.base64url(sender.encapsulatedKey), ct: RemoteCoding.base64url(sealed))
    }

    /// The 64 key bytes of a grant, opened with the device's key. Check them against the chain
    /// before use (`SealedChainState.openGrant` does).
    static func open(_ grant: SealedGrant, with kem: SealedKem) throws -> SealedRawScopeKeys {
        guard let enc = RemoteCoding.data(base64url: grant.enc),
            let ct = RemoteCoding.data(base64url: grant.ct),
            let scopeId = RemoteCoding.data(base64url: grant.scope)
        else { throw SealedError("Grant is malformed.") }
        var plain: Data
        do {
            switch kem {
            case .software(let key):
                var receiver = try HPKE.Recipient(
                    privateKey: key, ciphersuite: suite, info: info(grant), encapsulatedKey: enc)
                plain = try receiver.open(ct)
            case .enclave(let key):
                var receiver = try HPKE.Recipient(
                    privateKey: key, ciphersuite: suite, info: info(grant), encapsulatedKey: enc)
                plain = try receiver.open(ct)
            }
        } catch {
            throw SealedError("Grant failed authentication.")
        }
        guard plain.count == 64 else { throw SealedError("Grant holds the wrong key size.") }
        return SealedRawScopeKeys(
            scopeId: scopeId, epoch: grant.epoch, dataKey: plain.prefix(32), indexKey: plain.suffix(32))
    }
}
