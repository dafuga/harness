import CryptoKit
import Foundation

struct VaultDeviceChallenge {
    let origin: String
    let deviceId: String
    let nonce: String
    let expiresAt: Int64
}

struct VaultDeviceProof: Encodable {
    let deviceId: String
    let nonce: String
    let payload: String
    let signature: String
}

/// The caller supplies a native signer. Only a public key, signed envelope or ciphertext travels.
enum VaultApprovalCrypto {
    typealias Sign = (Data) throws -> Data

    static func queue(_ challenge: VaultDeviceChallenge, now: Int64, sign: Sign) throws -> VaultDeviceProof {
        guard now < challenge.expiresAt else { throw VaultApprovalFailure.expired }
        return try prove(challenge, body: Data("{}".utf8), request: nil, sign: sign)
    }

    static func decision(
        _ request: VaultApprovalRequest, intent: VaultApprovalIntent, at challenge: VaultDeviceChallenge,
        sign: Sign
    ) throws -> VaultDeviceProof {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        guard now < challenge.expiresAt else { throw VaultApprovalFailure.expired }
        let recipient = try request.recipient(now: now)
        let payload = try body(request, intent: intent, key: recipient, expiresAt: min(request.expiresAt, challenge.expiresAt))
        return try prove(challenge, body: payload, request: request, sign: sign)
    }

    private static func body(
        _ request: VaultApprovalRequest, intent: VaultApprovalIntent, key: Data, expiresAt: Int64
    ) throws -> Data {
        var value: [String: Any] = [
            "requestId": request.requestId,
            "runnerFingerprint": request.runnerFingerprint,
            "recipeDigest": request.recipe.digest
        ]
        if case .deny = intent {
            value["decision"] = "deny"
        } else {
            let plain = try intent.plaintext(for: request.method)
            value["decision"] = "approve"
            value["method"] = request.method.rawValue
            value["mode"] = request.mode.rawValue
            value["account"] = request.account
            value["session"] = request.session
            value["action"] = request.action
            value["host"] = request.host
            value["leaseMs"] = request.leaseMs
            value["otpIncluded"] = false
            value["expiresAt"] = expiresAt
            if let plain = plain {
                value["sealed"] = try seal(plain, to: key, requestId: request.requestId)
            } else {
                value["sealed"] = NSNull()
            }
        }
        guard let data = RemoteCoding.json(value) else { throw VaultApprovalFailure.payload }
        return data
    }

    private static func prove(
        _ challenge: VaultDeviceChallenge, body: Data, request: VaultApprovalRequest?, sign: Sign
    ) throws -> VaultDeviceProof {
        let path = request == nil ? "/v1/device/requests" : "/v1/device/decision"
        let version = request == nil ? "CB-DEVICE-V1" : "CB-DEVICE-V2"
        var lines = [version, challenge.origin, path, challenge.deviceId, challenge.nonce,
                     RemoteCoding.hex(RemoteCoding.sha256(body))]
        if let request = request {
            lines += [request.recipe.digest, request.runnerFingerprint, request.method.rawValue,
                      "\(request.mode.rawValue):\(request.leaseMs)"]
        }
        guard lines.allSatisfy({ $0.utf8.allSatisfy { (32...126).contains($0) } })
        else { throw VaultApprovalFailure.binding }
        let signature = try sign(Data(lines.joined(separator: "\n").utf8))
        guard signature.count == 64 else { throw VaultApprovalFailure.binding }
        return VaultDeviceProof(deviceId: challenge.deviceId, nonce: challenge.nonce,
                                payload: RemoteCoding.base64url(body), signature: RemoteCoding.base64url(signature))
    }

    private static func seal(_ credential: [String: String], to recipient: Data, requestId: String) throws -> [String: String] {
        guard var plaintext = RemoteCoding.json(credential), plaintext.count <= 8192
        else { throw VaultApprovalFailure.payload }
        defer { plaintext.resetBytes(in: plaintext.startIndex..<plaintext.endIndex) }
        let sender = Curve25519.KeyAgreement.PrivateKey()
        let peer = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: recipient)
        let shared = try sender.sharedSecretFromKeyAgreement(with: peer)
        let salt = RemoteCoding.random(32)
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: salt, sharedInfo: Data("credential-broker/seal/v1".utf8), outputByteCount: 32)
        let box = try ChaChaPoly.seal(plaintext, using: key, nonce: ChaChaPoly.Nonce(data: Data(count: 12)),
                                      authenticating: Data(requestId.utf8))
        return ["senderPublicKey": RemoteCoding.base64url(sender.publicKey.rawRepresentation),
                "salt": RemoteCoding.base64url(salt), "ciphertext": RemoteCoding.base64url(box.ciphertext + box.tag)]
    }
}
