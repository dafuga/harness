import CryptoKit
import Foundation

private struct Command: Decodable {
    let origin: String
    let deviceId: String
    let nonce: String
    let expiresAt: Int64
    let request: VaultApprovalRequest?
    let decision: String?

    var challenge: VaultDeviceChallenge {
        VaultDeviceChallenge(origin: origin, deviceId: deviceId, nonce: nonce, expiresAt: expiresAt)
    }

    func proof(sign: VaultApprovalCrypto.Sign) throws -> VaultDeviceProof {
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
}

@main
enum TestPhone {
    static func main() async {
        if CommandLine.arguments.dropFirst().first == "--device-guards" {
            exit(await deviceGuards() ? 0 : 2)
        }
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

    private static func deviceGuards() async -> Bool {
        let site = "https://vault.example.test"
        let id = "synthetic-iphone"
        let device = VaultDeviceApproval(scope: .init(origin: site, deviceId: id))
        let wrong = VaultDeviceChallenge(origin: "https://wrong.example.test", deviceId: id, nonce: "test", expiresAt: .max)
        let expired = VaultDeviceChallenge(origin: site, deviceId: id, nonce: "test", expiresAt: 0)
        do {
            _ = try await device.queue(wrong)
            return false
        } catch VaultApprovalFailure.binding {
            // An untrusted broker is refused before any Face ID or Keychain call.
        } catch {
            return false
        }
        do {
            _ = try await device.queue(expired)
            return false
        } catch VaultApprovalFailure.expired {
            return true
        } catch {
            return false
        }
    }

    private static func send<T: Encodable>(_ value: T) {
        guard let bytes = try? JSONEncoder().encode(value) else { exit(2) }
        print(String(decoding: bytes, as: UTF8.self))
        fflush(stdout)
    }
}
