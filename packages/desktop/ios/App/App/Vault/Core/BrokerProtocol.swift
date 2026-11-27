import CryptoKit
import Foundation
import Security

public enum BrokerError: LocalizedError {
    case invalidOrigin
    case invalidDevice
    case invalidRequest
    case invalidCredential
    case expired
    case transport
    case routeProtected
    case serverUnreachable
    case malformedResponse
    case http(Int)

    public init(httpStatus: Int) {
        self = httpStatus == 530 ? .serverUnreachable : .http(httpStatus)
    }

    public var errorDescription: String? {
        if case .serverUnreachable = self { return "Credential server unreachable, try again shortly" }
        return nil
    }
}

public enum BrokerPath: String, Sendable {
    case challenge = "/v1/device/challenge"
    case requests = "/v1/device/requests"
    case decision = "/v1/device/decision"
    case imports = "/v1/device/imports"
    case importDecision = "/v1/device/import/decision"
    case importComplete = "/v1/device/import/complete"
    case backupPut = "/v1/device/backup/put"
    case backupGet = "/v1/device/backup/get"
    case privateBrowserChallenge = "/v1/private-browser/challenge"
    case privateBrowserOffer = "/v1/private-browser/offer"
    case privateBrowserSubmit = "/v1/private-browser/submit"
}

/// The broker origin and device identity that every signed request is bound to.
public struct BrokerSigner: Sendable {
    public let origin: String
    public let deviceID: String

    public init(origin: String, deviceID: String) {
        self.origin = origin
        self.deviceID = deviceID
    }
}

public enum BrokerProtocol {
    public static func validDeviceID(_ value: String) -> Bool {
        value.range(of: #"\A[a-z][a-z0-9-]{0,47}\z"#, options: .regularExpression) != nil
    }

    public static func origin(_ value: String) throws -> URL {
        guard let parts = URLComponents(string: value), let url = parts.url,
              parts.scheme == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.path.isEmpty,
              parts.query == nil, parts.fragment == nil, url.absoluteString == value,
              parts.port.map({ (1...65_535).contains($0) }) ?? true else {
            throw BrokerError.invalidOrigin
        }
        return url
    }

    public static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    public static func decode(_ string: String, size: Int? = nil) throws -> Data {
        var standard = string.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        standard += String(repeating: "=", count: (4 - standard.count % 4) % 4)
        guard let bytes = Data(base64Encoded: standard), base64url(bytes) == string,
              size.map({ bytes.count == $0 }) ?? true else {
            throw BrokerError.malformedResponse
        }
        return bytes
    }

    static func random32Bytes() throws -> Data {
        var bytes = Data(count: 32)
        let status = bytes.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, $0.count, $0.baseAddress!)
        }
        guard status == errSecSuccess else { throw BrokerError.transport }
        return bytes
    }

    public static func fingerprint(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    public static func signingInput(
        for device: BrokerSigner, path: BrokerPath, nonce: String, payload: Data
    ) -> Data {
        Data(["CB-DEVICE-V1", device.origin, path.rawValue, device.deviceID, nonce, fingerprint(payload)]
            .joined(separator: "\n").utf8)
    }

    public static func validRequestID(_ value: String) -> Bool {
        value.range(of: #"\A[0-9a-f]{32}\z"#, options: .regularExpression) != nil
    }
}

public struct BrokerPushTarget: Equatable, Sendable {
    public let requestID: String
    private let brokerFingerprint: String

    public init?(userInfo: [AnyHashable: Any]) {
        guard let target = userInfo["vaultRequest"] as? [String: String],
              Set(target.keys) == ["requestId", "broker"],
              let requestID = target["requestId"], BrokerProtocol.validRequestID(requestID),
              let broker = target["broker"],
              broker.range(of: #"\A[0-9a-f]{64}\z"#, options: .regularExpression) != nil else { return nil }
        self.requestID = requestID
        brokerFingerprint = broker
    }

    public func matches(origin: String) -> Bool {
        brokerFingerprint == BrokerProtocol.fingerprint(Data(origin.utf8))
    }
}

public struct BrokerRequest: Codable, Identifiable, Equatable, Sendable {
    public struct Command: Codable, Equatable, Sendable {
        public let executable: String
        public let args: [String]
        public let cwd: String
    }

    public let requestId: String
    public let itemId: String
    public let session: String
    public let service: String
    public let action: String
    public let reason: String
    public let expiresAt: Int64
    public let sessionPublicKey: String
    public let sessionKeyFingerprint: String
    public let clientUid: Int?
    public let command: Command
    public let requireServiceOtp: Bool?
    public let approvalOnly: Bool?
    public let site: String?
    public let account: String?
    /// The password may only be released for this saved website.
    public let websiteDomain: String?
    /// The sign-in may ask for its verification code later, as a separate code-only request.
    public let deferredOtp: Bool?
    /// That later request: it takes a fresh code and never a password.
    public let codeOnly: Bool?
    /// The approval must name this offer and the broker it was made to.
    public let selectionId: String?

    public var id: String { requestId }

    public func verifiedSessionKey() throws -> Curve25519.KeyAgreement.PublicKey {
        let bytes = try BrokerProtocol.decode(sessionPublicKey, size: 32)
        guard BrokerProtocol.validRequestID(id), BrokerProtocol.fingerprint(bytes) == sessionKeyFingerprint else {
            throw BrokerError.invalidRequest
        }
        return try Curve25519.KeyAgreement.PublicKey(rawRepresentation: bytes)
    }
}
