import Foundation

// A QR code is only an offer to ask with. These checks hold the reader of the app and the
// boundary around its camera to that: what is not the exact text of a current offer for this
// build is refused before anything is sent, and what a camera says is never more than a request
// a person still has to approve. The same texts are judged by TypeScript in
// packages/remote/test/support/offer-vectors.json; ../Vectors proves that both agree.

private let moment = Date(timeIntervalSince1970: 1_791_892_800)
private let host = String(repeating: "a", count: 40)
private let pairing = String(repeating: "b", count: 32)

private func offerText(env: String = "production", exp: Int = 1_791_893_040, origin: String = "https://relay.example.invalid") -> String {
    "harness-pair:v1;aud=harness-phone;env=\(env);exp=\(exp);host=\(host);pairing=\(pairing);code=KQ7M2XWP;origin=\(origin)"
}

private func refusal(_ text: String, _ environments: [String] = ["production"]) -> RemoteOffer.Refusal? {
    if case .failure(let refusal) = RemoteOffer.read(text, now: moment, environments: environments) { return refusal }
    return nil
}

private func failure(_ outcome: RemoteScanOutcome) -> RemoteScanFailure? {
    if case .failure(let failure) = RemoteScanFlow.input(outcome, deviceName: "Ada iPhone", now: moment) { return failure }
    return nil
}

func offerChecks() {
    let read = try? RemoteOffer.read(offerText(), now: moment, environments: ["production"]).get()
    let fields = [read?.origin, read?.hostId, read?.pairingId, read?.code]
    check(fields == ["https://relay.example.invalid", host, pairing, "KQ7M2XWP"], "the text a computer writes reads back as its offer")
    check(read?.expires == Date(timeIntervalSince1970: 1_791_893_040), "an offer that is read carries the moment it ends")
    check(refusal(offerText(exp: 1_791_892_800)) == .expired, "an offer that ended this second is expired")
    check(refusal(offerText(exp: 1_791_893_160)) == nil, "an offer may claim its short life and a minute of a slow clock")
    check(refusal(offerText(exp: 1_791_893_161)) == .invalid, "an offer that claims a longer life than one can have is none")
    check(refusal(offerText().replacingOccurrences(of: ":v1;", with: ":v2;")) == .unsupported, "another version is unsupported, not misread")
    check(refusal(offerText().replacingOccurrences(of: "harness-phone", with: "harness-hub")) == .unsupported, "an offer for another audience is not for this app")
    let extended = [offerText() + ";credential=abc", offerText() + "\n", " " + offerText(), offerText() + " "]
    check(extended.allSatisfy { refusal($0) == .invalid }, "a field, a line or a space around the offer makes it none")
    let origins = [
        "https://relay.example.invalid/", "https://Relay.example.invalid", "https://relay.example.invalid:443",
        "https://localhost", "https://127.0.0.1", "https://user@relay.example.invalid", "http://relay.example.invalid"
    ]
    check(origins.allSatisfy { refusal(offerText(origin: $0)) == .invalid }, "only the exact https origin of a named relay is an offer")
    check(refusal("harnessremote://pair?origin=https%3A%2F%2Frelay.example.invalid&host=\(host)&pairing=\(pairing)") == .invalid, "a pairing link of earlier versions is no offer")
    check(refusal(String(repeating: "a", count: 400)) == .invalid && refusal("") == .invalid, "text of any other kind or length is no offer")
    let local = offerText(env: "local", origin: "http://127.0.0.1:8787")
    check(refusal(local) == .environment, "a build that asks production relays refuses an offer of this machine")
    check(refusal(local, ["production", "local"]) == nil, "a build that accepts this machine reads its offer")
    check(refusal(offerText(env: "local")) == .invalid, "an offer that names another environment than its relay is none")
}

func scanChecks() {
    let codes = [
        "camera-denied", "camera-unavailable", "scan-cancelled", "offer-invalid", "offer-unsupported", "offer-environment",
        "offer-expired"
    ]
    check(RemoteScanFailure.allCases.map { $0.rawValue } == codes, "a scan ends without an offer in the seven ways the page knows, by the same codes")
    check(RemoteScanFailure.allCases.allSatisfy { !$0.message.isEmpty }, "each of them has words of its own")
    check(failure(.denied) == .cameraDenied && failure(.unavailable) == .cameraUnavailable, "a camera that is refused or missing is said as that")
    check(failure(.cancelled) == .cancelled, "a scan a person cancelled sends nothing and says so")
    check(failure(.text("https://example.com/")) == .invalid, "a QR code of anything else is not an offer")
    check(failure(.text(offerText(exp: 1_791_892_799))) == .expired, "a code that expired is not asked with")
    check(failure(.text(offerText().replacingOccurrences(of: ":v1;", with: ":v9;"))) == .unsupported, "a code of another version is not asked with")
    let asked = try? RemoteScanFlow.input(.text(offerText()), deviceName: "Ada iPhone", now: moment).get()
    let input = [asked?.origin, asked?.hostId, asked?.pairingId, asked?.code, asked?.deviceName]
    check(input == ["https://relay.example.invalid", host, pairing, "KQ7M2XWP", "Ada iPhone"], "a current offer becomes exactly the request of this phone, under its name")
    check(RemoteScanFlow.name("  Ada iPhone ") == "Ada iPhone", "the name of the phone is trimmed")
    let unnamed: [String?] = [nil, "", "   ", String(repeating: "a", count: 81)]
    check(unnamed.allSatisfy { RemoteScanFlow.name($0) == nil }, "a phone without a name of at most 80 characters does not scan")
    let local = RemoteScanOutcome.text(offerText(env: "local", origin: "http://127.0.0.1:8787"))
    #if DEBUG
    RemoteDebug.loopback = false
    check(failure(local) == .environment, "Debug without the opt-in does not ask a relay on this machine")
    RemoteDebug.loopback = true
    check(failure(local) == nil, "Debug with the opt-in asks the relay of a local fixture")
    check(failure(.text(offerText())) == nil, "and still asks a production relay")
    RemoteDebug.loopback = false
    #else
    check(failure(local) == .environment, "Release never asks a relay on this machine; no switch for it exists")
    check(RemotePolicy.environments == ["production"], "Release accepts production offers only")
    #endif
}
