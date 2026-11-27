import CryptoKit
import Foundation

public enum PairingError: Error {
    case invalidOffer
    case expired
    case invalidEnrollment
    case alreadySealed
    case activationUnconfirmed
}

public struct PairingOffer: Sendable {
    public let origin: String
    public let expiresAt: Int64
    let nonce: String
    let computerPublicKey: String

    public static var timestamp: Int64 { Int64(Date().timeIntervalSince1970 * 1_000) }

    private struct Wire: Decodable {
        let origin: String
        let nonce: String
        let expiresAt: Int64
        let computerPublicKey: String
    }

    public init(scan: String, now: Int64 = Self.timestamp) throws {
        let prefix = "vault-pair:v2:"
        let required = Set(["origin", "nonce", "expiresAt", "computerPublicKey"])
        guard scan.utf8.count <= 2_048, scan.hasPrefix(prefix),
              let raw = try? BrokerProtocol.decode(String(scan.dropFirst(prefix.count))),
              let fields = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
              Set(fields.keys) == required,
              let wire = try? JSONDecoder().decode(Wire.self, from: raw),
              (try? BrokerProtocol.origin(wire.origin)) != nil,
              (try? BrokerProtocol.decode(wire.nonce, size: 32)) != nil,
              let pk = try? BrokerProtocol.decode(wire.computerPublicKey, size: 32),
              !pk.allSatisfy({ $0 == 0 }) else {
            throw PairingError.invalidOffer
        }
        origin = wire.origin
        expiresAt = wire.expiresAt
        nonce = wire.nonce
        computerPublicKey = wire.computerPublicKey
        try checkExpiry(now: now)
    }

    public func checkExpiry(now: Int64 = Self.timestamp) throws {
        guard (0...4_102_444_800_000).contains(now), expiresAt > now,
              expiresAt <= now + 300_000 else { throw PairingError.expired }
    }
}

@MainActor
public final class PairingExchange {
    public nonisolated let offer: PairingOffer
    nonisolated let phonePublicKey: String
    let transcript: Data
    private var sealKey: SymmetricKey?

    public convenience init(offer: PairingOffer) throws {
        try self.init(offer: offer, phone: Curve25519.KeyAgreement.PrivateKey())
    }

    init(offer: PairingOffer, phone: Curve25519.KeyAgreement.PrivateKey) throws {
        self.offer = offer
        phonePublicKey = BrokerProtocol.base64url(phone.publicKey.rawRepresentation)
        let transcript = Data(["CB-PAIR-V2", offer.origin, offer.nonce, String(offer.expiresAt),
                               offer.computerPublicKey, phonePublicKey].joined(separator: "\n").utf8)
        self.transcript = transcript
        let computer = try Curve25519.KeyAgreement.PublicKey(rawRepresentation:
            BrokerProtocol.decode(offer.computerPublicKey, size: 32))
        let shared = try phone.sharedSecretFromKeyAgreement(with: computer)
        let salt = try BrokerProtocol.decode(offer.nonce, size: 32)
        sealKey = shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: salt,
            sharedInfo: Data("credential-broker/pair/v2/seal\n".utf8) + transcript, outputByteCount: 32)
    }

    public func seal(_ enrollment: PairingEnrollment) throws -> PairingSubmission {
        guard let sealKey else { throw PairingError.alreadySealed }
        try enrollment.validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes, .sortedKeys]
        let payload = try encoder.encode(enrollment)
        let sealed = try ChaChaPoly.seal(payload, using: sealKey, nonce: .init(data: Data(repeating: 0, count: 12)),
                                        authenticating: transcript)
        self.sealKey = nil
        return PairingSubmission(nonce: offer.nonce, phonePublicKey: phonePublicKey,
                                 ciphertext: BrokerProtocol.base64url(sealed.ciphertext + sealed.tag))
    }
}

public struct PairingEnrollment: Codable, Sendable {
    public let deviceId: String
    public let signingKey: String
    public let importKey: String
    public let recoveryKey: String

    public init(deviceId: String, signingKey: String, importKey: String, recoveryKey: String) {
        self.deviceId = deviceId
        self.signingKey = signingKey
        self.importKey = importKey
        self.recoveryKey = recoveryKey
    }

    fileprivate func validate() throws {
        guard BrokerProtocol.validDeviceID(deviceId) else { throw PairingError.invalidEnrollment }
        let signing = try BrokerProtocol.decode(signingKey, size: 65)
        let imports = try BrokerProtocol.decode(importKey, size: 65)
        let recovery = try BrokerProtocol.decode(recoveryKey, size: 65)
        guard Set([signing, imports, recovery]).count == 3 else { throw PairingError.invalidEnrollment }
        _ = try P256.Signing.PublicKey(x963Representation: signing)
        _ = try P256.KeyAgreement.PublicKey(x963Representation: imports)
        _ = try P256.KeyAgreement.PublicKey(x963Representation: recovery)
    }
}

public struct PairingSubmission: Encodable, Sendable {
    let nonce: String
    let phonePublicKey: String
    let ciphertext: String
}
