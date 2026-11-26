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

    static func resolve(
        service: String, site: String?, account: String?, entries: [VaultAccountCandidate]
    ) -> Self {
        guard let entry = entries.first(where: { $0.service == service }) else { return .missing }
        if let account, account != entry.username { return .missing }
        return .ready(entry)
    }
}
