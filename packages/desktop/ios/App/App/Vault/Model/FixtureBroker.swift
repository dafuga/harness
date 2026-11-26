#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

final class FixtureBroker: DeviceBroker {
    var request: BrokerRequest?
    let receiver = Curve25519.KeyAgreement.PrivateKey()
    let importFixture: PasswordImportFixture?
    let addFixture: VaultAddFixture?
    var importDelivered = false
    var addDecision: VaultAddDecision.Choice?
    var publishedAddKey = false
    var pollAttempts = 0
    let offline: Bool
    var importKey: P256.KeyAgreement.PrivateKey? { importFixture?.recipient ?? addFixture?.recipient }

    var arguments: [String] { ProcessInfo.processInfo.arguments }

    init(origin: String, offline: Bool = false) {
        self.offline = offline
        let publicKey = receiver.publicKey.rawRepresentation
        let now = Int64(Date().timeIntervalSince1970 * 1_000)
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--vault-add") {
            addFixture = try! VaultAddFixture(origin: origin, expiresAt: now + VaultAddSummary.maximumLifetime)
            importFixture = nil
            return
        }
        addFixture = nil
        if args.contains("--password-import") {
            importFixture = try! PasswordImportFixture(origin: origin, expiresAt: now + 115_000)
            return
        }
        importFixture = nil
        request = Self.releaseRequest(publicKey: publicKey, now: now, arguments: args)
    }

    private static func releaseRequest(publicKey: Data, now: Int64, arguments: [String]) -> BrokerRequest {
        let expiresAt = arguments.contains("--expired-release") ? now - 1_000 : now + 115_000
        let approvalOnly = arguments.contains("--approval-only")
        let target = arguments.contains("--request-target")
            ? ", \"site\": \"registry.example\", \"account\": \"qa@example.test\"" : ""
        let fixture = """
        {
            "requestId": "00112233445566778899aabbccddeeff",
            "itemId": "demo01",
            "session": "Synthetic QA",
            "service": "Demo registry",
            "action": "verify-account",
            "reason": "\(approvalOnly ? "CoS test - safe to approve" : "Verify the test account using a synthetic credential.")",
            "approvalOnly": \(approvalOnly)\(target),
            "expiresAt": \(expiresAt),
            "sessionPublicKey": "\(BrokerProtocol.base64url(publicKey))",
            "sessionKeyFingerprint": "\(BrokerProtocol.fingerprint(publicKey))",
            "clientUid": 1000,
            "requireServiceOtp": \(arguments.contains("--require-service-code")),
            "command": {"executable": "/usr/bin/true", "args": [], "cwd": "/tmp"}
        }
        """
        return try! JSONDecoder().decode(BrokerRequest.self, from: Data(fixture.utf8))
    }
}
#endif
