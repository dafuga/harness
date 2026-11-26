#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

@MainActor
enum PairingFixture {
    private static let computer = Curve25519.KeyAgreement.PrivateKey()
    private static let nonce = Data(repeating: 47, count: 32)

    static func scanPayload() -> String {
        let fields: [String: Any] = [
            "origin": "https://pairing.example",
            "nonce": BrokerProtocol.base64url(nonce),
            "computerPublicKey": BrokerProtocol.base64url(computer.publicKey.rawRepresentation),
            "expiresAt": PairingOffer.timestamp + 120_000,
        ]
        return "vault-pair:v2:" + BrokerProtocol.base64url(try! JSONSerialization.data(withJSONObject: fields))
    }

    static func submit(_ exchange: PairingExchange) throws {
        let signing = P256.Signing.PrivateKey()
        let recovery = P256.KeyAgreement.PrivateKey()
        let imports = P256.KeyAgreement.PrivateKey()
        let enrollment = PairingEnrollment(
            deviceId: "simulator-phone",
            signingKey: BrokerProtocol.base64url(signing.publicKey.x963Representation),
            importKey: BrokerProtocol.base64url(imports.publicKey.x963Representation),
            recoveryKey: BrokerProtocol.base64url(recovery.publicKey.x963Representation)
        )
        let sealed = try exchange.seal(enrollment)
        let transmitted = try JSONEncoder().encode(sealed)
        let fields = try JSONDecoder().decode([String: String].self, from: transmitted)
        guard Set(fields.keys) == ["nonce", "phonePublicKey", "ciphertext"],
              transmitted.range(of: Data(enrollment.signingKey.utf8)) == nil else {
            throw PairingError.invalidEnrollment
        }
    }
}
#endif
