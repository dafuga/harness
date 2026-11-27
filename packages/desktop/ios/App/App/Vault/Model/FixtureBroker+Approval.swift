#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

@available(iOS 17.0, *)
extension FixtureBroker {
    func verifyFixtureApproval(_ decision: [String: Any], request: BrokerRequest) throws {
        guard let sealed = decision["sealed"] as? [String: String],
              let sender = sealed["senderPublicKey"], let salt = sealed["salt"],
              let ciphertext = sealed["ciphertext"] else { throw BrokerError.invalidRequest }
        let senderKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: BrokerProtocol.decode(sender, size: 32))
        let shared = try receiver.sharedSecretFromKeyAgreement(with: senderKey)
        let key = try shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: BrokerProtocol.decode(salt, size: 32),
            sharedInfo: Data("credential-broker/seal/v1".utf8), outputByteCount: 32
        )
        let box = try ChaChaPoly.SealedBox(
            combined: Data(repeating: 0, count: 12) + BrokerProtocol.decode(ciphertext)
        )
        let plaintext = try ChaChaPoly.open(box, using: key, authenticating: Data(request.id.utf8))
        let fields = try JSONSerialization.jsonObject(with: plaintext) as? [String: Any]
        guard fields?["password"] as? String == MemoryVault.password,
              fields?["otp"] as? String == "123456" else { throw BrokerError.invalidCredential }
    }
}
#endif
