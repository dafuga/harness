import CryptoKit
import Foundation

/// The secret material of one pairing attempt (backend-contract.md section 4.4). It exists in
/// memory only: the device key reaches the Keychain when the computer approved exactly it, and
/// the typed code leaves the phone sealed to the host key that hashes to the id of the link.
struct RemotePairingMaterial {
    struct Approval {
        let credential: String
        let hostName: String
        let generation: Int
        let grant: RemoteGrant
    }

    let deviceKey = P256.KeyAgreement.PrivateKey()
    let verifier = RemoteCoding.base64url(RemoteCoding.random(32))
    private let ephemeral = P256.KeyAgreement.PrivateKey()
    private var keys: RemotePairingKeys?

    var deviceId: String {
        RemoteCoding.identity(of: deviceKey.publicKey.x963Representation)
    }

    /// The body of the pairing request, or nil when the relay named a key that is not the one
    /// of the link, or the pairing is not open.
    mutating func request(_ input: RemotePairing.Input, info: [String: Any]) -> [String: Any]? {
        guard let hostKey = (info["hostKey"] as? String).flatMap(RemoteCoding.data(base64url:)),
            RemoteCoding.identity(of: hostKey) == input.hostId, info["state"] as? String == "open",
            let keys = try? RemoteCrypto.pairingKeys(
                ephemeral: ephemeral, hostKey: hostKey, hostId: input.hostId, pairingId: input.pairingId)
        else { return nil }
        let challenge = RemoteCoding.base64url(RemoteCoding.sha256(Data(verifier.utf8)))
        let secret: [String: Any] = [
            "code": input.code,
            "deviceKey": RemoteCoding.base64url(deviceKey.publicKey.x963Representation),
            "deviceName": input.deviceName,
            "platform": "ios",
            "challenge": challenge
        ]
        guard let plain = RemoteCoding.json(secret), let sealed = try? RemoteCrypto.sealRequest(plain, key: keys.request)
        else { return nil }
        self.keys = keys
        return [
            "ephemeralKey": RemoteCoding.base64url(ephemeral.publicKey.x963Representation),
            "sealed": sealed,
            "challenge": challenge
        ]
    }

    /// What the computer approved, when it binds exactly this device key; nil otherwise.
    func approval(_ answer: [String: Any]) -> Approval? {
        guard let keys = keys, let credential = answer["credential"] as? String,
            let sealed = answer["sealed"] as? String,
            let plain = try? RemoteCrypto.openApproval(sealed, key: keys.approval),
            let approval = RemoteCoding.object(plain), approval["deviceId"] as? String == deviceId,
            answer["deviceId"] as? String == deviceId, let grant = RemoteGrant(approval["grant"]),
            let generation = approval["generation"] as? Int
        else { return nil }
        let hostName = approval["hostName"] as? String ?? "Computer"
        return Approval(credential: credential, hostName: hostName, generation: generation, grant: grant)
    }
}
