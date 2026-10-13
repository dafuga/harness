import Foundation

// From what a camera read to the pairing it asks for, a session takes a turn of its queue. These
// checks hold that queue still, so that what is asked meanwhile waits in the order it was asked:
// first what the camera read, then the leaving. A Disconnect that waits behind a scan must come
// first: nothing is asked, nothing is announced but unpaired, and nothing comes back later.

private func offerText() -> String {
    let ends = Int(Date().timeIntervalSince1970) + 120
    let fields = "exp=\(ends);host=\(String(repeating: "a", count: 40));pairing=\(String(repeating: "b", count: 32));code=KQ7M2XWP"
    #if DEBUG
    return "harness-pair:v1;aud=harness-phone;env=local;\(fields);origin=http://127.0.0.1:9"
    #else
    return "harness-pair:v1;aud=harness-phone;env=production;\(fields);origin=https://relay.example.invalid"
    #endif
}

private func answer(_ result: Result<[String: Any], RemoteFailure>) -> String {
    switch result {
    case .success(let status): return "asked: \(status["state"] as? String ?? "")"
    case .failure(let failure): return failure.code
    }
}

/// Holds the queue of a session still until the answer is called: what a check asks meanwhile
/// waits behind it, in order.
private func held(_ bench: Bench) -> () -> Void {
    let entered = DispatchSemaphore(value: 0)
    let gate = DispatchSemaphore(value: 0)
    bench.session.queue.async {
        entered.signal()
        gate.wait()
    }
    entered.wait()
    return { gate.signal() }
}

/// Every turn that was waiting, and every turn those turns asked for, has been taken.
private func drained(_ bench: Bench) {
    for _ in 0..<4 { bench.settle() }
}

private func states(_ bench: Bench) -> [String] {
    bench.statuses.compactMap { $0["state"] as? String }
}

private func pairing(_ bench: Bench) -> Bool {
    bench.session.queue.sync { bench.session.pairing != nil || bench.session.pending != nil }
}

/// What the camera read is first in line and the leaving second, with the queue held still.
private func overtakenChecks() {
    let bench = Bench(record: nil)
    bench.start()
    let camera = HeldScanner()
    var answers: [String] = []
    bench.session.scan(camera, deviceName: "Check phone") { answers.append(answer($0)) }
    bench.settle()
    let release = held(bench)
    camera.answer(.text(offerText()))
    var left = ""
    bench.session.disconnect { left = $0["state"] as? String ?? "" }
    release()
    drained(bench)
    check(left == "unpaired", "a Disconnect that waits behind what the camera read answers unpaired")
    check(states(bench) == ["unpaired"], "nothing is announced but unpaired: no pairing before it and none after it")
    check(!pairing(bench), "no pairing was begun, so no relay was asked")
    check(answers == ["scan-cancelled"], "the page is answered once: the scan was cancelled")
    check(camera.cancels == 1, "the camera of that scan was taken away")
    Thread.sleep(forTimeInterval: 0.3)
    drained(bench)
    check(states(bench) == ["unpaired"] && !pairing(bench) && answers.count == 1, "and nothing of it comes back later")
    try? FileManager.default.removeItem(at: bench.root)
}

/// The same camera answering twice in a row begins at most one pairing; leaving ends it.
private func repeatedChecks() {
    let bench = Bench(record: nil)
    bench.start()
    let first = HeldScanner()
    let second = HeldScanner()
    var answers: [String] = []
    bench.session.scan(first, deviceName: "Check phone") { answers.append("first \(answer($0))") }
    bench.settle()
    let release = held(bench)
    first.answer(.text("https://example.com/"))
    bench.session.scan(second, deviceName: "Check phone") { answers.append("second \(answer($0))") }
    bench.session.disconnect { _ in }
    release()
    drained(bench)
    check(answers.first == "first offer-invalid", "a code that is no offer ends its scan at once")
    check(second.scans == 1 && second.cancels == 1, "a scan asked for behind it opens, and the leaving behind that ends it")
    check(answers == ["first offer-invalid", "second scan-cancelled"] && !pairing(bench), "each scan is answered once and nobody was asked")
    check(states(bench) == ["unpaired"], "only the leaving is announced")
    try? FileManager.default.removeItem(at: bench.root)
}

func scanHandoffChecks() {
    #if DEBUG
    RemoteDebug.loopback = true
    #endif
    overtakenChecks()
    repeatedChecks()
    #if DEBUG
    let bench = Bench(record: nil)
    bench.start()
    let camera = HeldScanner()
    var answers: [String] = []
    bench.session.scan(camera, deviceName: "Check phone") { answers.append(answer($0)) }
    bench.settle()
    camera.answer(.text(offerText()))
    drained(bench)
    check(answers == ["asked: pairing"] && pairing(bench), "a fresh scan that nobody leaves still asks with the offer it read")
    bench.session.disconnect { _ in }
    drained(bench)
    check(!pairing(bench) && states(bench).last == "unpaired", "leaving after the pairing began ends that pairing")
    let direct = RemotePairing.Input(
        origin: "http://127.0.0.1:9", hostId: String(repeating: "a", count: 40), pairingId: String(repeating: "b", count: 32),
        code: "KQ7M2XWP", deviceName: "Check phone")
    var asked = ""
    bench.session.pair(direct) { asked = answer($0) }
    drained(bench)
    check(asked == "asked: pairing" && pairing(bench), "a pairing asked for directly begins as it did before")
    bench.session.pair(direct) { asked = answer($0) }
    drained(bench)
    check(asked == "failed", "and a second one beside it is refused as before")
    bench.session.disconnect { _ in }
    drained(bench)
    try? FileManager.default.removeItem(at: bench.root)
    RemoteDebug.loopback = false
    #endif
}
