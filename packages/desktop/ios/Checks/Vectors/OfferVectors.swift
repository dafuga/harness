import Foundation

// The offers of packages/remote/test/support/offer-vectors.json, read by the Swift of the app.
// TypeScript judges the same file in packages/remote/test/utils/pairing-offer.test.ts: each text
// must be an offer, or be refused for the same reason, on both sides.

func offerVectors(_ path: String) {
    guard let file = try? Data(contentsOf: URL(fileURLWithPath: path)), let root = RemoteCoding.object(file),
        let milliseconds = root["now"] as? Double, let cases = root["cases"] as? [[String: Any]]
    else { return check(false, "the offer vectors could not be read") }
    let now = Date(timeIntervalSince1970: milliseconds / 1000)
    var agreed = 0
    for item in cases {
        let environments = item["environments"] as? [String] ?? []
        let said: String
        switch RemoteOffer.read(text(item, "text"), now: now, environments: environments) {
        case .success: said = "ok"
        case .failure(let refusal): said = refusal.rawValue
        }
        if said == text(item, "result") { agreed += 1 } else { check(false, "offer vector: \(text(item, "name")) is \(said)") }
    }
    check(cases.count > 60 && agreed == cases.count, "all \(cases.count) offer vectors read as TypeScript reads them")
    let valid = root["valid"] as? [String: Any] ?? [:]
    let offer = valid["offer"] as? [String: Any] ?? [:]
    let read = try? RemoteOffer.read(text(valid, "text"), now: now, environments: ["production"]).get()
    let same = read?.origin == text(offer, "origin") && read?.hostId == text(offer, "hostId")
        && read?.pairingId == text(offer, "pairingId") && read?.code == text(offer, "code")
    let ends = ISO8601DateFormatter()
    ends.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    check(same && read?.expires == ends.date(from: text(offer, "expiresAt")), "the valid offer reads back field by field")
}
