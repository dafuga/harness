import CryptoKit
import Foundation

private struct Command: Decodable {
    let origin: String
    let deviceId: String
    let nonce: String
    let expiresAt: Int64
    let request: VaultApprovalRequest?
    let decision: String?
    let privateOffer: PrivateBrowserOffer?
    let privateRequest: PrivateRequest?

    struct PrivateRequest: Decodable {
        let path: String
        let payload: String
    }

    var challenge: VaultDeviceChallenge {
        VaultDeviceChallenge(origin: origin, deviceId: deviceId, nonce: nonce, expiresAt: expiresAt)
    }

    func proof(sign: VaultApprovalCrypto.Sign) throws -> VaultDeviceProof {
        if let privateRequest {
            guard let path = BrokerPath(rawValue: privateRequest.path),
                  path == .privateBrowserChallenge || path == .privateBrowserOffer else {
                throw BrokerError.invalidRequest
            }
            return try privateProof(path, payload: BrokerProtocol.decode(privateRequest.payload), sign: sign)
        }
        if let privateOffer {
            let now = Int64(Date().timeIntervalSince1970 * 1_000)
            let payload = if privateOffer.fields == nil {
                try privateOffer.seal("7", now: now)
            } else {
                try privateOffer.seal(privateOffer.fieldNames.indices.map { String($0 + 7) }, now: now)
            }
            return try privateProof(.privateBrowserSubmit, payload: payload, sign: sign)
        }
        guard let request = request else {
            return try VaultApprovalCrypto.queue(challenge, now: Int64(Date().timeIntervalSince1970 * 1000), sign: sign)
        }
        let intent: VaultApprovalIntent
        switch decision {
        case "password": intent = .browser(password: "synthetic-ios-password")
        case "token": intent = .apiToken("synthetic-ios-api-token")
        case "grant": intent = .deviceGrant
        case "deny": intent = .deny
        default: throw VaultApprovalFailure.payload
        }
        return try VaultApprovalCrypto.decision(request, intent: intent, at: challenge, sign: sign)
    }

    private func privateProof(
        _ path: BrokerPath, payload: Data, sign: VaultApprovalCrypto.Sign
    ) throws -> VaultDeviceProof {
        let proof = BrokerProtocol.signingInput(
            for: .init(origin: origin, deviceID: deviceId), path: path, nonce: nonce, payload: payload
        )
        return VaultDeviceProof(
            deviceId: deviceId, nonce: nonce, payload: BrokerProtocol.base64url(payload),
            signature: BrokerProtocol.base64url(try sign(proof))
        )
    }
}

@main
enum TestPhone {
    static func main() {
        if CommandLine.arguments.count == 2 {
            exit((try? verifyLegacyAdd(CommandLine.arguments[1])) == true ? 0 : 2)
        }
        let key = P256.Signing.PrivateKey()
        send(["signingKey": RemoteCoding.base64url(key.publicKey.x963Representation)])
        while let line = readLine() {
            do {
                let command = try JSONDecoder().decode(Command.self, from: Data(line.utf8))
                let proof = try command.proof { try key.signature(for: $0).rawRepresentation }
                send(proof)
            } catch {
                send(["error": "Native Vault refused the request."])
            }
        }
    }

    private static func send<T: Encodable>(_ value: T) {
        guard let bytes = try? JSONEncoder().encode(value) else { exit(2) }
        print(String(decoding: bytes, as: UTF8.self))
        fflush(stdout)
    }
}
