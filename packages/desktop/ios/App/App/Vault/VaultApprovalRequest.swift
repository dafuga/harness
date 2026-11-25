import Foundation

/// Public metadata from the authenticated broker queue. Native UI can render this as received.
struct VaultApprovalRequest: Decodable {
    struct Recipe: Decodable {
        let site: String
        let revision: Int
        let digest: String
    }

    enum Method: String, Decodable {
        case browser
        case apiToken = "api-token"
        case oauthDevice = "oauth-device"
    }

    enum Mode: String, Decodable {
        case read, write
    }

    let requestId: String
    let item: String
    let session: String
    let project: String
    let environment: String
    let site: String
    let action: String
    let account: String
    let mode: Mode
    let method: Method
    let recipe: Recipe
    let host: String
    let runnerPublicKey: String
    let runnerFingerprint: String
    let origins: [String]
    let leaseMs: Int
    let reason: String
    let expiresAt: Int64

    var isPasswordGeneration: Bool { action == "generate-password" }

    /// Validate the binding locally before displaying a request or sealing to its recipient.
    func recipient(now: Int64) throws -> Data {
        guard now < expiresAt else { throw VaultApprovalFailure.expired }
        guard requestId.utf8.count == 32, requestId.utf8.allSatisfy(Self.hex),
            recipe.site == site, recipe.revision > 0, leaseMs > 0,
            recipe.digest.utf8.count == 64, recipe.digest.utf8.allSatisfy(Self.hex),
            let key = RemoteCoding.data(base64url: runnerPublicKey), key.count == 32,
            RemoteCoding.base64url(key) == runnerPublicKey,
            RemoteCoding.hex(RemoteCoding.sha256(key)) == runnerFingerprint
        else { throw VaultApprovalFailure.binding }
        return key
    }

    private static func hex(_ byte: UInt8) -> Bool {
        (48...57).contains(byte) || (97...102).contains(byte)
    }
}

enum VaultApprovalFailure: Error {
    case binding, expired, payload, credentialMethod
}

/// Plaintext stays in native code. SMS and email challenges use separate runner keys and prompts.
enum VaultApprovalIntent {
    case deny
    case browser(password: String)
    case apiToken(String)
    case deviceGrant
    case generatePassword

    func plaintext(for request: VaultApprovalRequest) throws -> [String: String]? {
        if request.isPasswordGeneration {
            guard case .generatePassword = self, request.method == .browser, request.mode == .write
            else { throw VaultApprovalFailure.credentialMethod }
            return nil
        }
        switch (self, request.method) {
        case (.browser(let password), .browser) where !password.isEmpty: return ["password": password]
        case (.apiToken(let token), .apiToken) where !token.isEmpty: return ["token": token]
        case (.deviceGrant, .oauthDevice), (.deny, _): return nil
        default: throw VaultApprovalFailure.credentialMethod
        }
    }
}
