import CryptoKit
import Foundation

enum RemoteCryptoError: Error {
    case packet
}

/// One key per direction; a phone seals with `d2h` and opens with `h2d`.
struct RemoteDirectionKeys {
    let d2h: SymmetricKey
    let h2d: SymmetricKey
}

struct RemotePairingKeys {
    let request: SymmetricKey
    let approval: SymmetricKey
}

/// What one sealed packet is bound to besides its key: the direction it travels in, its counter
/// in that direction, and whether more of the same message follows.
struct RemotePacketContext {
    let direction: String
    let counter: UInt64
    let more: Bool

    /// The additional data both sides authenticate; a packet moved, replayed or cut fails on it.
    var authenticated: Data {
        Data("harness-remote/v1/\(direction)/\(counter)/\(more ? "1" : "0")".utf8)
    }
}

/// Everything both sides put into the session keys. Public keys are X9.63 points.
struct RemoteHandshake {
    let hostId: String
    let deviceId: String
    let generation: Int
    let deviceStatic: P256.KeyAgreement.PrivateKey
    let deviceEphemeral: P256.KeyAgreement.PrivateKey
    let hostStaticKey: Data
    let hostEphemeralKey: Data
    let deviceNonce: Data
    let hostNonce: Data
}

/// The secure channel of backend-contract.md section 4: P-256, HKDF-SHA256, AES-256-GCM.
enum RemoteCrypto {
    static func agree(_ own: P256.KeyAgreement.PrivateKey, _ peer: Data) throws -> Data {
        let key = try P256.KeyAgreement.PublicKey(x963Representation: peer)
        return try own.sharedSecretFromKeyAgreement(with: key).withUnsafeBytes { Data($0) }
    }

    private static func expand(_ material: Data, salt: Data, info: String) -> (Data, Data) {
        let key = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: material),
            salt: salt,
            info: Data(info.utf8),
            outputByteCount: 64
        )
        let bytes = key.withUnsafeBytes { Data($0) }
        return (Data(bytes.prefix(32)), Data(bytes.suffix(32)))
    }

    /// Triple Diffie-Hellman: both static keys and both fresh keys bind the session.
    static func sessionKeys(_ input: RemoteHandshake) throws -> RemoteDirectionKeys {
        var material = try agree(input.deviceEphemeral, input.hostEphemeralKey)
        material += try agree(input.deviceStatic, input.hostEphemeralKey)
        material += try agree(input.deviceEphemeral, input.hostStaticKey)
        let label = "harness-remote/v1/session\n\(input.hostId)\n\(input.deviceId)\n\(input.generation)\n"
        var transcript = Data(label.utf8)
        transcript += input.deviceStatic.publicKey.x963Representation
        transcript += input.hostStaticKey
        transcript += input.deviceEphemeral.publicKey.x963Representation
        transcript += input.hostEphemeralKey
        transcript += input.deviceNonce
        transcript += input.hostNonce
        let salt = RemoteCoding.sha256(transcript)
        let (first, second) = expand(material, salt: salt, info: "harness-remote/v1/keys")
        return RemoteDirectionKeys(d2h: SymmetricKey(data: first), h2d: SymmetricKey(data: second))
    }

    private static func nonce(_ counter: UInt64) throws -> AES.GCM.Nonce {
        var bytes = Data(count: 4)
        withUnsafeBytes(of: counter.bigEndian) { bytes.append(contentsOf: $0) }
        return try AES.GCM.Nonce(data: bytes)
    }

    static func seal(_ plain: Data, key: SymmetricKey, context: RemotePacketContext) throws -> String {
        let box = try AES.GCM.seal(
            plain, using: key, nonce: nonce(context.counter), authenticating: context.authenticated)
        return RemoteCoding.base64url(box.ciphertext + box.tag)
    }

    static func open(_ text: String, key: SymmetricKey, context: RemotePacketContext) throws -> Data {
        guard let data = RemoteCoding.data(base64url: text), data.count >= 16 else {
            throw RemoteCryptoError.packet
        }
        let box = try AES.GCM.SealedBox(
            nonce: nonce(context.counter), ciphertext: Data(data.dropLast(16)), tag: Data(data.suffix(16)))
        return try AES.GCM.open(box, using: key, authenticating: context.authenticated)
    }

    /// One-shot keys of a pairing: only the host key that hashes to `hostId` can read the request.
    static func pairingKeys(
        ephemeral: P256.KeyAgreement.PrivateKey, hostKey: Data, hostId: String, pairingId: String
    ) throws -> RemotePairingKeys {
        let material = try agree(ephemeral, hostKey)
        var transcript = Data("harness-remote/v1/pairing\n\(hostId)\n\(pairingId)\n".utf8)
        transcript += ephemeral.publicKey.x963Representation
        transcript += hostKey
        let salt = RemoteCoding.sha256(transcript)
        let (first, second) = expand(material, salt: salt, info: "harness-remote/v1/pairing-keys")
        return RemotePairingKeys(request: SymmetricKey(data: first), approval: SymmetricKey(data: second))
    }

    /// Each pairing key is used once, so its nonce is twelve zero bytes.
    static func sealRequest(_ plain: Data, key: SymmetricKey) throws -> String {
        let zero = try AES.GCM.Nonce(data: Data(count: 12))
        let label = Data("harness-remote/v1/pairing-request".utf8)
        let box = try AES.GCM.seal(plain, using: key, nonce: zero, authenticating: label)
        return RemoteCoding.base64url(box.ciphertext + box.tag)
    }

    static func openApproval(_ text: String, key: SymmetricKey) throws -> Data {
        guard let data = RemoteCoding.data(base64url: text), data.count >= 16 else {
            throw RemoteCryptoError.packet
        }
        let zero = try AES.GCM.Nonce(data: Data(count: 12))
        let label = Data("harness-remote/v1/pairing-approval".utf8)
        let box = try AES.GCM.SealedBox(
            nonce: zero, ciphertext: Data(data.dropLast(16)), tag: Data(data.suffix(16)))
        return try AES.GCM.open(box, using: key, authenticating: label)
    }
}
