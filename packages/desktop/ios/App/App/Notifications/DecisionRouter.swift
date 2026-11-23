import Foundation

/// One entry of the last fresh, signed decision inbox. Only what routing needs is kept.
struct DecisionEntry: Equatable {
    enum State: Equatable {
        case pending, decided, expired
    }

    let category: DecisionCategory
    let reference: String
    let source: String
    let state: State
}

/// The exact in-app item an alert opens. Routing only ever opens a review of it; nothing here
/// approves, denies, signs or launches.
struct DecisionTarget: Equatable {
    let category: DecisionCategory
    let reference: String
    let source: String
}

/// The outcome of one alert. Every refusal fails closed and shows an unavailable state.
enum DecisionRoute: Equatable {
    /// The exact pending item, opened for review.
    case review(DecisionTarget)
    /// The same alert arrived again on this device; it opens the same item and is not routed twice.
    case duplicate(DecisionTarget)
    /// The request was decided or expired after the alert was sent.
    case stale(DecisionTarget)
    /// The source is no longer routed to this device.
    case revoked
    /// The reference is not in the fresh inbox. Refresh the inbox before routing it again.
    case unknown
    /// The reference exists in this source under the other category.
    case mismatch
}

/// Routes alerts against the last fresh inbox. References are unique within a source, so a
/// reference from one broker never opens an item of another. A refresh replaces the entries
/// and revocations but keeps which alerts were already routed on this device.
struct DecisionRouter {
    private(set) var entries: [DecisionEntry]
    private(set) var revokedSources: Set<String>
    private var routed: Set<String> = []

    init(entries: [DecisionEntry], revokedSources: Set<String> = []) {
        self.entries = entries
        self.revokedSources = revokedSources
    }

    mutating func refresh(entries: [DecisionEntry], revokedSources: Set<String>) {
        self.entries = entries
        self.revokedSources = revokedSources
    }

    mutating func route(_ alert: DecisionAlert) -> DecisionRoute {
        guard !revokedSources.contains(alert.source) else { return .revoked }
        guard let entry = entries.first(where: { $0.source == alert.source && $0.reference == alert.reference })
        else { return .unknown }
        let target = DecisionTarget(category: alert.category, reference: alert.reference, source: alert.source)
        guard entry.category == alert.category else { return .mismatch }
        guard entry.state == .pending else { return .stale(target) }
        let key = "\(alert.source)/\(alert.reference)"
        return routed.insert(key).inserted ? .review(target) : .duplicate(target)
    }
}
