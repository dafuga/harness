import Foundation

// A scan is one look through the camera, and only the look that is still under way may start a
// pairing. These checks put a camera that answers when a check says so on a real session:
// leaving ends the look, and a code that camera reads afterwards asks nobody. The camera of the
// app is not here; what is checked is the boundary every camera answers through.

/// A camera a check holds: it records what it is asked and answers when told.
final class HeldScanner: RemoteScanner {
    var scans = 0
    var cancels = 0
    private var done: ((RemoteScanOutcome) -> Void)?

    func scan(done: @escaping (RemoteScanOutcome) -> Void) {
        scans += 1
        self.done = done
    }

    func cancel() {
        cancels += 1
    }

    func answer(_ outcome: RemoteScanOutcome) {
        let done = self.done
        self.done = nil
        done?(outcome)
    }
}

/// A current offer. In a Debug check it names a relay on this machine that nothing listens on,
/// so that a pairing a check allows to start reaches no network.
private func currentOffer() -> String {
    let ends = Int(Date().timeIntervalSince1970) + 120
    let host = String(repeating: "a", count: 40)
    let fields = "exp=\(ends);host=\(host);pairing=\(String(repeating: "b", count: 32));code=KQ7M2XWP"
    #if DEBUG
    return "harness-pair:v1;aud=harness-phone;env=local;\(fields);origin=http://127.0.0.1:9"
    #else
    return "harness-pair:v1;aud=harness-phone;env=production;\(fields);origin=https://relay.example.invalid"
    #endif
}

private func ended(_ result: Result<[String: Any], RemoteFailure>) -> String {
    switch result {
    case .success(let status): return "asked: \(status["state"] as? String ?? "")"
    case .failure(let failure): return failure.code
    }
}

private func asked(_ bench: Bench) -> Bool {
    bench.settle()
    let pairing = bench.session.queue.sync { bench.session.pairing != nil }
    return pairing || bench.statuses.contains { ["pairing", "pending-approval"].contains($0["state"] as? String ?? "") }
}

/// A scan that was left: nothing it reads afterwards may ask a computer.
private func leftScanChecks() {
    let bench = Bench(record: nil)
    bench.start()
    let camera = HeldScanner()
    var answers: [String] = []
    bench.session.scan(camera, deviceName: "Check phone") { answers.append(ended($0)) }
    bench.settle()
    check(camera.scans == 1 && answers.isEmpty, "a scan opens the camera once and waits for it")
    bench.session.disconnect { _ in }
    bench.settle()
    check(camera.cancels == 1, "leaving takes the camera of an open scan away")
    check(answers == ["scan-cancelled"], "leaving answers the page once: the scan was cancelled")
    camera.answer(.text(currentOffer()))
    check(!asked(bench), "a code read after leaving starts no pairing and asks no relay")
    check(answers == ["scan-cancelled"] && bench.state == "unpaired", "the page hears nothing more of it and the phone stays unpaired")
    try? FileManager.default.removeItem(at: bench.root)
}

/// One look at a time, and a look that ended without an offer leaves room for the next.
private func singleScanChecks() {
    let bench = Bench(record: nil)
    bench.start()
    let first = HeldScanner()
    let second = HeldScanner()
    var answers: [String] = []
    bench.session.scan(first, deviceName: "Check phone") { answers.append("first \(ended($0))") }
    bench.session.scan(second, deviceName: "Check phone") { answers.append("second \(ended($0))") }
    bench.settle()
    check(first.scans == 1 && second.scans == 0, "a second scan does not open a second camera")
    check(answers == ["second failed"], "the second scan is refused while the first is open")
    first.answer(.cancelled)
    bench.settle()
    check(answers == ["second failed", "first scan-cancelled"] && !asked(bench), "a cancelled look asks nobody")
    let third = HeldScanner()
    bench.session.scan(third, deviceName: "Check phone") { answers.append("third \(ended($0))") }
    bench.settle()
    third.answer(.text("https://example.com/"))
    bench.settle()
    check(third.scans == 1 && answers.last == "third offer-invalid" && !asked(bench), "after it another look may open, and a code that is no offer asks nobody")
    first.answer(.text(currentOffer()))
    check(!asked(bench) && answers.count == 3, "an earlier camera that answers again is not heard")
    try? FileManager.default.removeItem(at: bench.root)
}

func scanLifecycleChecks() {
    #if DEBUG
    RemoteDebug.loopback = true
    #endif
    leftScanChecks()
    singleScanChecks()
    #if DEBUG
    let bench = Bench(record: nil)
    bench.start()
    let camera = HeldScanner()
    var answers: [String] = []
    bench.session.scan(camera, deviceName: "Check phone") { answers.append(ended($0)) }
    bench.settle()
    camera.answer(.text(currentOffer()))
    check(asked(bench) && answers == ["asked: pairing"], "the look that is under way does ask with the offer it read")
    bench.session.disconnect { _ in }
    bench.settle()
    try? FileManager.default.removeItem(at: bench.root)
    RemoteDebug.loopback = false
    #endif
}
