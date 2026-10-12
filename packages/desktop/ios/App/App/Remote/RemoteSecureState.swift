import CryptoKit
import Foundation

/// The end-to-end state of one link: the handshake keys, one counter per direction and the
/// message being reassembled (backend-contract.md section 4). A new handshake starts all of it
/// again; nothing of an earlier one is reused.
struct RemoteSecureState {
    enum Opened {
        case message(Data)
        case partial
        case invalid
    }

    private var ephemeral = P256.KeyAgreement.PrivateKey()
    private var nonce = Data()
    private var keys: RemoteDirectionKeys?
    private var sendCounter: UInt64 = 0
    private var receiveCounter: UInt64 = 0
    private var buffer = Data()

    /// A fresh key, a fresh nonce and counters at zero, as the `hello` of a new handshake.
    mutating func hello(deviceId: String) -> [String: Any] {
        self = RemoteSecureState()
        nonce = RemoteCoding.random(16)
        return [
            "type": "hello", "version": 1, "deviceId": deviceId,
            "ephemeralKey": RemoteCoding.base64url(ephemeral.publicKey.x963Representation),
            "nonce": RemoteCoding.base64url(nonce)
        ]
    }

    /// The computer went away: nothing is sealed or opened until a new handshake.
    mutating func drop() {
        keys = nil
    }

    /// The generation the computer accepted under, or nil when its answer cannot be used.
    mutating func accept(_ packet: [String: Any], record: RemoteRecord) -> Int? {
        guard packet["version"] as? Int == 1, let generation = packet["generation"] as? Int,
            let hostEphemeral = (packet["ephemeralKey"] as? String).flatMap(RemoteCoding.data(base64url:)),
            let hostNonce = (packet["nonce"] as? String).flatMap(RemoteCoding.data(base64url:)),
            let hostKey = RemoteCoding.data(base64url: record.hostKey),
            let secret = RemoteCoding.data(base64url: record.deviceSecret),
            let own = try? P256.KeyAgreement.PrivateKey(rawRepresentation: secret),
            let derived = try? RemoteCrypto.sessionKeys(RemoteHandshake(
                hostId: record.hostId, deviceId: record.deviceId, generation: generation, deviceStatic: own,
                deviceEphemeral: ephemeral, hostStaticKey: hostKey, hostEphemeralKey: hostEphemeral,
                deviceNonce: nonce, hostNonce: hostNonce))
        else { return nil }
        keys = derived
        return generation
    }

    /// The sealed packets of one wire message: each has its own counter and says if more follow.
    mutating func seal(_ message: Data) -> [[String: Any]]? {
        guard let keys = keys else { return nil }
        var packets: [[String: Any]] = []
        var offset = 0
        repeat {
            let end = min(offset + RemoteLimits.chunkBytes, message.count)
            let more = end < message.count
            let context = RemotePacketContext(direction: "d2h", counter: sendCounter, more: more)
            guard let data = try? RemoteCrypto.seal(message.subdata(in: offset..<end), key: keys.d2h, context: context)
            else { return nil }
            packets.append(["type": "sealed", "counter": sendCounter, "more": more, "data": data])
            sendCounter += 1
            offset = end
        } while offset < message.count
        return packets
    }

    /// Exactly the expected counter is accepted. Anything else, or a failed tag, is invalid, and
    /// the link that received it ends.
    mutating func open(_ packet: [String: Any]) -> Opened {
        guard let keys = keys, let counter = packet["counter"] as? UInt64, counter == receiveCounter,
            let more = packet["more"] as? Bool, let data = packet["data"] as? String,
            let plain = try? RemoteCrypto.open(
                data, key: keys.h2d, context: RemotePacketContext(direction: "h2d", counter: counter, more: more))
        else { return .invalid }
        receiveCounter += 1
        buffer.append(plain)
        guard buffer.count <= RemoteLimits.messageBytes else { return .invalid }
        guard !more else { return .partial }
        let message = buffer
        buffer = Data()
        return .message(message)
    }
}
