import Foundation

/// The decision sources a closed phone can be alerted about. Each has its own inbox and review;
/// an alert never crosses from one to the other.
enum DecisionCategory: String, Equatable {
    case tracker
    case deploy
}

/// A secret-free alert. It carries an opaque reference and the SHA-256 of the exact source origin,
/// never the item, session, project, reason or any credential. Notification copy is not read.
struct DecisionAlert: Equatable {
    static let key = "harnessDecision"
    private static let allowedKeys: Set<String> = ["category", "reference", "source"]

    let category: DecisionCategory
    /// 32 lowercase hex characters, unique within one source.
    let reference: String
    /// 64 lowercase hex characters: SHA-256 of the exact source origin.
    let source: String

    /// Reads the custom object of a remote notification. Any unexpected key, type or format refuses
    /// the whole alert, so a payload that carries more than the reference is never routed.
    init?(userInfo: [AnyHashable: Any]) {
        guard let object = userInfo[Self.key] as? [String: Any],
            Set(object.keys) == Self.allowedKeys,
            let name = object["category"] as? String,
            let category = DecisionCategory(rawValue: name),
            let reference = object["reference"] as? String,
            let source = object["source"] as? String,
            AlertFormat.isHex(reference, length: 32), AlertFormat.isHex(source, length: 64)
        else { return nil }
        self.category = category
        self.reference = reference
        self.source = source
    }

    init(category: DecisionCategory, reference: String, source: String) {
        self.category = category
        self.reference = reference
        self.source = source
    }
}
