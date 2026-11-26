import Foundation

/// A saved login reduced to what choosing it needs. The password never enters the picker.
struct VaultAccountCandidate: Identifiable, Equatable, Sendable {
    let id: UUID
    let service: String
    let domain: String?
    let username: String
    let twoFactorEveryTime: Bool
}

/// Which saved logins can answer a vault request.
enum VaultAccountMatch: Equatable {
    /// The requester named an account and exactly one saved login has it.
    case ready(VaultAccountCandidate)
    /// Daniel picks. `requestedAccountMissing` means no saved login has the named account.
    case choose([VaultAccountCandidate], requestedAccountMissing: Bool)
    /// Nothing is saved for this service or site.
    case missing

    /// Only logins for this service or site are offered. The release step must check the picked id
    /// is still among them.
    static func resolve(
        service: String, site: String?, account: String?, entries: [VaultAccountCandidate]
    ) -> Self {
        let target = VaultSiteTarget(service: service, site: site)
        let offered = entries.compactMap { entry in target.rank(entry).map { (rank: $0, entry: entry) } }
            .sorted { ($0.rank, $0.entry.username, $0.entry.service) < ($1.rank, $1.entry.username, $1.entry.service) }
            .map(\.entry)
        guard !offered.isEmpty else { return .missing }
        guard let wanted = account?.lowercased(), !wanted.isEmpty else {
            return .choose(offered, requestedAccountMissing: false)
        }
        let named = offered.filter { $0.username.lowercased() == wanted }
        if named.count == 1 { return .ready(named[0]) }
        return .choose(named.isEmpty ? offered : named, requestedAccountMissing: named.isEmpty)
    }

    /// Only an unambiguous login starts selected: the named one, or the sole one when none is named.
    var preselection: UUID? {
        switch self {
        case .ready(let entry): entry.id
        case .choose(let entries, false): entries.count == 1 ? entries[0].id : nil
        case .choose(_, true), .missing: nil
        }
    }

    var offered: [VaultAccountCandidate] {
        switch self {
        case .ready(let entry): [entry]
        case .choose(let entries, _): entries
        case .missing: []
        }
    }
}

/// How closely a saved login belongs to the requested service and site. Lower ranks sort first.
private struct VaultSiteTarget {
    private enum Rank: Int {
        case service, host, relatedHost, name
    }

    /// Second-level labels such as the `co` in `example.co.uk` are not a site's name.
    private static let genericLabels: Set<String> = ["ac", "co", "com", "edu", "gov", "net", "org"]
    let service: String
    private let host: String?

    init(service: String, site: String?) {
        self.service = service
        host = site.flatMap(Self.host)
    }

    func rank(_ entry: VaultAccountCandidate) -> Int? {
        if entry.service == service { return Rank.service.rawValue }
        // A saved website, or an entry named after one, decides alone: its name cannot override it.
        if let saved = entry.domain.flatMap(Self.host) ?? Self.host(entry.service) {
            return rank(host: saved)?.rawValue
        }
        let name = entry.service.trimmingCharacters(in: .whitespaces).lowercased()
        let names = [service.lowercased(), host.flatMap(Self.brand)]
        return names.contains(name) ? Rank.name.rawValue : nil
    }

    private func rank(host saved: String) -> Rank? {
        guard let host else { return nil }
        if saved == host { return .host }
        // Whole labels only, and a bare suffix such as `com` is nobody's parent.
        let related = saved.hasSuffix("." + host) || (saved.contains(".") && host.hasSuffix("." + saved))
        return related ? .relatedHost : nil
    }

    /// Accepts `github.com` or a pasted address such as `https://www.github.com/login`.
    private static func host(_ value: String) -> String? {
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let address = text.contains("://") ? text : "https://" + text
        guard var host = URLComponents(string: address)?.host, host.contains(".") else { return nil }
        if host.hasSuffix(".") { host.removeLast() }
        if host.hasPrefix("www.") { host.removeFirst(4) }
        return host
    }

    private static func brand(_ host: String) -> String? {
        var labels = host.split(separator: ".").dropLast()
        if labels.count > 1, let last = labels.last, genericLabels.contains(String(last)) {
            labels = labels.dropLast()
        }
        return labels.last.map(String.init)
    }
}
