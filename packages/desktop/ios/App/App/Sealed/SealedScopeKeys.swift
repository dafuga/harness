import CryptoKit
import Foundation

/// The key bytes of one scope at one epoch, as they travel inside a grant.
struct SealedRawScopeKeys {
    let scopeId: Data
    let epoch: UInt32
    let dataKey: Data
    let indexKey: Data

    /// Fresh keys for a new scope at epoch 0, or the next epoch of `rotating` (same index key).
    static func make(rotating: SealedRawScopeKeys? = nil) -> SealedRawScopeKeys {
        SealedRawScopeKeys(
            scopeId: rotating?.scopeId ?? RemoteCoding.random(16),
            epoch: rotating.map { $0.epoch + 1 } ?? 0, dataKey: RemoteCoding.random(32),
            indexKey: rotating?.indexKey ?? RemoteCoding.random(32))
    }

    /// SHA-256 over label ‖ scope id ‖ epoch ‖ data key ‖ index key; the chain records it.
    func commitment() throws -> Data {
        guard scopeId.count == 16, dataKey.count == 32, indexKey.count == 32 else {
            throw SealedError("Scope key sizes are wrong.")
        }
        return SealedBytes.sha256(
            SealedBytes.text("harness/sealed/v1/commit\0"), scopeId, SealedBytes.u32(epoch), dataKey,
            indexKey)
    }
}

/// Scope keys ready for use. The commitment is computed from the bytes, so a grant is accepted
/// only when it matches the chain.
struct SealedScopeKeys {
    let scopeId: Data
    let epoch: UInt32
    let dataKey: SymmetricKey
    let indexKey: SymmetricKey
    let commitment: Data

    init(_ raw: SealedRawScopeKeys) throws {
        commitment = try raw.commitment()
        scopeId = raw.scopeId
        epoch = raw.epoch
        dataKey = SealedBytes.key(raw.dataKey)
        indexKey = SealedBytes.key(raw.indexKey)
    }

    /// The base64url scope id the chain and the server use.
    var name: String { RemoteCoding.base64url(scopeId) }

    var raw: SealedRawScopeKeys {
        SealedRawScopeKeys(
            scopeId: scopeId, epoch: epoch, dataKey: SealedBytes.bytes(dataKey),
            indexKey: SealedBytes.bytes(indexKey))
    }

    /// HMAC-SHA256(index key, kind ‖ 0 ‖ local id): the same id in every epoch, meaningless to the server.
    func objectId(kind: String, localId: String) throws -> Data {
        guard !kind.contains("\0") else { throw SealedError("Object kind cannot contain NUL.") }
        let code = HMAC<SHA256>.authenticationCode(
            for: SealedBytes.text("\(kind)\0\(localId)"), using: indexKey)
        return Data(code)
    }
}
