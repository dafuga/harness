import Foundation

/// The one-time offer a computer shows as a QR code, read by the rule of
/// packages/remote/src/utils/pairingOffer.ts: only the exact text a computer writes is an offer.
/// No other order, field, spelling, length or version is one. An offer lets this phone ask; it
/// is no credential, and reading it grants nothing.
enum RemoteOffer {
    /// Why a scanned text is not an offer this build may ask with.
    enum Refusal: String, Error {
        case invalid, unsupported, environment, expired
    }

    struct Fields {
        let origin: String
        let hostId: String
        let pairingId: String
        let code: String
        let expires: Date
    }

    static let audience = "harness-phone"
    static let maxLength = 320
    /// The life of an offer, and a minute the clock of this phone may run behind.
    static let ahead: TimeInterval = 360

    private static let name = "[a-z0-9](?:-?[a-z0-9])*"
    private static let port = "(?::([1-9][0-9]{0,4}))?"
    /// A named relay: lower-case labels, the last one starting with a letter, never an address.
    private static let remote = "^https://((?:\(name)\\.)*[a-z](?:-?[a-z0-9])*)\(port)$"
    private static let loopback = "^http://(?:127\\.0\\.0\\.1|localhost|\\[::1\\])\(port)$"
    private static let versioned = "^harness-pair:v([0-9]{1,3});"
    /// The whole text, field by field, in the one order it is written in.
    private static let shape = "^harness-pair:v1;aud=([a-z-]{1,32});env=([a-z]{1,16});exp=([0-9]{10})"
        + ";host=([a-f0-9]{40});pairing=([a-f0-9]{32});code=([A-HJ-NP-Z2-9]{8});origin=([!-~]{1,200})$"

    /// The groups of a pattern in a text. `whole` asks that the match is all of the text, to its
    /// last character: a line end after it is not passed over.
    private static func groups(_ pattern: String, _ text: String, whole: Bool = true) -> [String?]? {
        let range = NSRange(location: 0, length: text.utf16.count)
        guard let regex = try? NSRegularExpression(pattern: pattern),
            let match = regex.firstMatch(in: text, options: [], range: range),
            !whole || match.range == range
        else { return nil }
        return (0..<match.numberOfRanges).map { index in
            Range(match.range(at: index), in: text).map { String(text[$0]) }
        }
    }

    /// A port that is written out is a real one, and never the one the scheme already means.
    private static func allowed(_ written: String?, standard: Int) -> Bool {
        guard let written = written else { return true }
        guard let port = Int(written) else { return false }
        return port <= 65535 && port != standard
    }

    /// The kind of relay an exact origin names, or nil when an offer may not carry it.
    static func environment(of origin: String) -> String? {
        if let far = groups(remote, origin) {
            return far[1] != "localhost" && allowed(far[2], standard: 443) ? "production" : nil
        }
        guard let near = groups(loopback, origin) else { return nil }
        return allowed(near[1], standard: 80) ? "local" : nil
    }

    /// Why the fields of a well-formed text are not an offer for this build now, or nil.
    private static func refusal(_ found: [String], now: Date, environments: [String]) -> Refusal? {
        let ends = Date(timeIntervalSince1970: TimeInterval(found[2]) ?? 0)
        guard found[0] == audience else { return .unsupported }
        guard let kind = environment(of: found[6]) else { return .invalid }
        guard ["production", "local"].contains(found[1]) else { return .environment }
        guard found[1] == kind else { return .invalid }
        guard environments.contains(kind) else { return .environment }
        guard ends <= now.addingTimeInterval(ahead) else { return .invalid }
        return ends <= now ? .expired : nil
    }

    /// What a scanned text is to this build at this moment: an offer to ask with, or why not.
    static func read(_ text: String, now: Date, environments: [String]) -> Result<Fields, Refusal> {
        guard text.utf16.count <= maxLength, let version = groups(versioned, text, whole: false)?[1] else {
            return .failure(.invalid)
        }
        guard version == "1" else { return .failure(.unsupported) }
        guard let found = groups(shape, text)?.dropFirst().compactMap({ $0 }), found.count == 7 else {
            return .failure(.invalid)
        }
        if let refused = refusal(Array(found), now: now, environments: environments) { return .failure(refused) }
        let expires = Date(timeIntervalSince1970: TimeInterval(found[2]) ?? 0)
        return .success(Fields(origin: found[6], hostId: found[3], pairingId: found[4], code: found[5], expires: expires))
    }
}
