import Foundation

/// Test driver: reads match cases as JSON on stdin and prints each outcome. Synthetic data only.
private struct Case: Decodable {
    struct Entry: Decodable {
        let service: String
        let domain: String?
        let username: String
    }

    let service: String
    let site: String?
    let account: String?
    let entries: [Entry]
}

private struct Outcome: Encodable {
    let kind: String
    let offered: [String]
}

@main
struct AccountMatchDriver {
    static func main() throws {
        let input = FileHandle.standardInput.readDataToEndOfFile()
        let outcomes = try JSONDecoder().decode([Case].self, from: input).map(run)
        FileHandle.standardOutput.write(try JSONEncoder().encode(outcomes))
    }

    private static func run(_ value: Case) -> Outcome {
        let entries = value.entries.map {
            VaultAccountCandidate(id: UUID(), service: $0.service, domain: $0.domain,
                                  username: $0.username, twoFactorEveryTime: false)
        }
        switch VaultAccountMatch.resolve(service: value.service, site: value.site,
                                         account: value.account, entries: entries) {
        case .ready(let entry): return Outcome(kind: "ready", offered: [label(entry)])
        case .choose(let offered, let absent):
            return Outcome(kind: absent ? "choose-account-missing" : "choose", offered: offered.map(label))
        case .missing: return Outcome(kind: "missing", offered: [])
        }
    }

    private static func label(_ entry: VaultAccountCandidate) -> String {
        "\(entry.service)|\(entry.username)"
    }
}
