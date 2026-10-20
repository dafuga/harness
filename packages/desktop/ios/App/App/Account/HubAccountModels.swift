import Foundation

/// The only failure the account plugin reports to the page: a code and display words. No
/// session, verifier, nonce or prose of the Hub is ever part of one.
struct HubAccountFailure: Error, Equatable {
    let code: String
    let message: String

    static let notConfigured = HubAccountFailure(
        code: "not-configured", message: "Shared projects are not set up for this app.")
    static let signedOut = HubAccountFailure(code: "session-required", message: "Sign in to continue.")
    static let refused = HubAccountFailure(
        code: "request-refused", message: "This request is not made from this phone.")
    static let offline = HubAccountFailure(
        code: "offline", message: "The Harness Hub could not be reached. Shared projects need a connection.")
    static let tooLarge = HubAccountFailure(
        code: "too-large", message: "The answer of the Hub is too large for this phone.")
    static let redirected = HubAccountFailure(
        code: "failed", message: "The Hub sent this request elsewhere. Nothing was sent there.")
    static let superseded = HubAccountFailure(
        code: "superseded", message: "The account on this phone changed. Reload and try again.")
    static let expired = HubAccountFailure(
        code: "handoff-expired", message: "This sign-in expired or was refused. Connect again.")
    static let mismatch = HubAccountFailure(
        code: "account-mismatch", message: "The Hub did not confirm this Google account. Sign in again.")
    static let unkept = HubAccountFailure(
        code: "failed", message: "This phone could not keep the sign-in in its Keychain.")
    static let failed = HubAccountFailure(code: "failed", message: "The Hub could not complete this request.")

    /// What the Hub refused a sign-in with, by the few codes a person can act on.
    static func hub(_ reply: HubAccountReply) -> HubAccountFailure {
        switch RemoteCoding.object(reply.data)?["error"] as? String {
        case "auth-disabled"?:
            return HubAccountFailure(code: "auth-disabled", message: "Sign-in is not configured for this Hub.")
        case "rate-limited"?:
            return HubAccountFailure(code: "rate-limited", message: "Too many attempts. Wait a moment and try again.")
        default: return failed
        }
    }
}

/// Bounds of the account's requests, in the units this side uses.
enum HubAccountLimits {
    static let replyBytes = 16_777_216
    static let bodyBytes = 65_536
    static let queryItems = 24
    static let queryValue = 2_048
    static let seconds = 30.0
    /// The longest a sign-in waits for approval, whatever the Hub states.
    static let handoffSeconds = 900.0
}

/// The session this phone keeps for its Hub account, whole in the Keychain. The token never
/// leaves this side; the rest is what the page may be told of the person.
struct HubAccountCredential: Codable, Equatable {
    var origin: String
    var subject: String
    var name: String
    var email: String
    var token: String
    var expiresAt: Date
}

/// One call of the page: a method and a path of the project API, its fields and its body. It
/// names no origin and no credential; HubAccountPolicy decides whether it is made at all.
struct HubAccountCall {
    let method: String
    let path: String
    let query: [String: String]
    let body: Data?

    init(method: String, path: String, query: [String: String] = [:], body: Data? = nil) {
        self.method = method
        self.path = path
        self.query = query
        self.body = body
    }

    /// What the plugin was handed, or nil when a field is not text or the body no JSON object.
    init?(_ options: [AnyHashable: Any]) {
        guard let method = options["method"] as? String, let path = options["path"] as? String,
            let query = Self.fields(options["query"])
        else { return nil }
        let value = options["body"]
        if value == nil || value is NSNull {
            self.init(method: method, path: path, query: query)
            return
        }
        guard let object = value as? [String: Any], let body = RemoteCoding.json(object) else { return nil }
        self.init(method: method, path: path, query: query, body: body)
    }

    private static func fields(_ value: Any?) -> [String: String]? {
        guard let value = value, !(value is NSNull) else { return [:] }
        guard let object = value as? [String: Any] else { return nil }
        var fields: [String: String] = [:]
        for (key, item) in object {
            guard let text = item as? String else { return nil }
            fields[key] = text
        }
        return fields
    }
}

/// What the Hub answered, as the page receives it: its status, its media type and its bytes in
/// base64. A refusal is an answer too, so that the page hears it as a browser would.
struct HubAccountReply {
    let status: Int
    let contentType: String
    let data: Data

    var object: [String: Any] {
        ["status": status, "contentType": contentType, "data": data.base64EncodedString()]
    }
}
