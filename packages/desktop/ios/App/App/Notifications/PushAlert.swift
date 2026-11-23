import Foundation

/// The one entry point for every alert the app receives on its single APNs topic. A notification
/// carries exactly one secret-free custom object: `harnessDecision` (Tracker or deploy) or
/// `vaultRequest` (a Vault approval). Both or neither refuses the alert.
enum PushAlert: Equatable {
    case decision(DecisionAlert)
    case vaultRequest(VaultRequestAlert)

    init?(userInfo: [AnyHashable: Any]) {
        let decision = userInfo[DecisionAlert.key] != nil
        let vault = userInfo[VaultRequestAlert.key] != nil
        guard decision != vault else { return nil }
        if decision {
            guard let alert = DecisionAlert(userInfo: userInfo) else { return nil }
            self = .decision(alert)
        } else {
            guard let alert = VaultRequestAlert(userInfo: userInfo) else { return nil }
            self = .vaultRequest(alert)
        }
    }
}

/// A Vault approval alert: the request ID and the SHA-256 of the broker origin. Nothing else.
struct VaultRequestAlert: Equatable {
    static let key = "vaultRequest"
    private static let allowedKeys: Set<String> = ["requestId", "broker"]

    /// 32 lowercase hex characters.
    let requestId: String
    /// 64 lowercase hex characters: SHA-256 of the exact broker HTTPS origin.
    let broker: String

    init?(userInfo: [AnyHashable: Any]) {
        guard let object = userInfo[Self.key] as? [String: Any],
            Set(object.keys) == Self.allowedKeys,
            let requestId = object["requestId"] as? String,
            let broker = object["broker"] as? String,
            AlertFormat.isHex(requestId, length: 32), AlertFormat.isHex(broker, length: 64)
        else { return nil }
        self.requestId = requestId
        self.broker = broker
    }
}

/// Shared by every alert object: lowercase hexadecimal of an exact length, nothing else.
enum AlertFormat {
    static func isHex(_ value: String, length: Int) -> Bool {
        value.utf8.count == length
            && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
}
