import CryptoKit
import Foundation

/// A refusal of the sealed layer: a changed byte, other keys, a bad chain. The text is for logs,
/// not for people; the app shows its own words.
struct SealedError: Error, Equatable, CustomStringConvertible {
    let message: String
    init(_ message: String) { self.message = message }
    var description: String { message }
}

/// Byte helpers of sealed v1: big-endian integers, labels, HKDF and AES-256-GCM with an explicit
/// nonce. They match packages/remote `sealed*`, which the vectors keep honest.
enum SealedBytes {
    static func u32(_ value: UInt32) -> Data {
        withUnsafeBytes(of: value.bigEndian) { Data($0) }
    }

    static func u64(_ value: UInt64) -> Data {
        withUnsafeBytes(of: value.bigEndian) { Data($0) }
    }

    static func readU32(_ data: Data, at offset: Int) -> UInt32 {
        data.subdata(in: (data.startIndex + offset)..<(data.startIndex + offset + 4))
            .reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    }

    static func readU64(_ data: Data, at offset: Int) -> UInt64 {
        data.subdata(in: (data.startIndex + offset)..<(data.startIndex + offset + 8))
            .reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
    }

    static func text(_ value: String) -> Data { Data(value.utf8) }

    static func key(_ data: Data) -> SymmetricKey { SymmetricKey(data: data) }

    static func bytes(_ key: SymmetricKey) -> Data { key.withUnsafeBytes { Data($0) } }

    /// 32 bytes of HKDF-SHA256 for one purpose, e.g. a per-record or per-stream AES key.
    static func derive(_ input: SymmetricKey, salt: Data, info: String) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(
            inputKeyMaterial: input, salt: salt, info: text(info), outputByteCount: 32)
    }

    /// Ciphertext followed by the 16-byte tag, as WebCrypto writes it.
    static func seal(_ plain: Data, key: SymmetricKey, nonce: Data, aad: Data) throws -> Data {
        let box = try AES.GCM.seal(
            plain, using: key, nonce: AES.GCM.Nonce(data: nonce), authenticating: aad)
        return box.ciphertext + box.tag
    }

    static func open(_ sealed: Data, key: SymmetricKey, nonce: Data, aad: Data) throws -> Data {
        guard sealed.count >= 16 else { throw SealedError("Sealed bytes are too short.") }
        let split = sealed.endIndex - 16
        let box = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: nonce), ciphertext: sealed[sealed.startIndex..<split],
            tag: sealed[split...])
        return try AES.GCM.open(box, using: key, authenticating: aad)
    }

    static func sha256(_ parts: Data...) -> Data {
        var hash = SHA256()
        for part in parts { hash.update(data: part) }
        return Data(hash.finalize())
    }
}
