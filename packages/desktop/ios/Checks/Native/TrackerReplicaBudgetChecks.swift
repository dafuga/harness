import Foundation

/// This fixture exercises SQLite and model reads with a larger copy than the session examples.
func trackerReplicaBudgetChecks() {
    let root = temporary("tracker-budget")
    defer { try? FileManager.default.removeItem(at: root) }
    let store = TrackerReplicaStore(root: root)
    store.enter("fixture-scope")
    let start = ProcessInfo.processInfo.systemUptime
    let clock = Date(timeIntervalSince1970: 1_800_000_000)
    do {
        try fillTrackerFixture(store, now: clock)
        let write = ProcessInfo.processInfo.systemUptime - start
        let readStart = ProcessInfo.processInfo.systemUptime
        let result = store.tool("tracker_search", input: ["query": "budget-"], online: false, now: clock)
        let read = ProcessInfo.processInfo.systemUptime - readStart
        let file = root.appendingPathComponent("fixture-scope/tracker.sqlite").path
        let bytes = try FileManager.default.attributesOfItem(atPath: file)[.size] as? Int ?? 0
        check((trackerDataFixture(result)["items"] as? [[String: Any]])?.count == 10, "tracker: a larger replica still caps search results")
        check(bytes > 0 && bytes < 24 * 1024 * 1024, "tracker: sample replica stays within the SQLite budget")
        print("tracker fixture: 800 items, SQLite \(bytes) bytes, write \(write) s, search \(read) s")
        let expired = store.tool("tracker_status", input: [:], online: false, now: clock.addingTimeInterval(7 * 86_400))
        check(expired["code"] as? String == "denied" && !FileManager.default.fileExists(atPath: file),
              "tracker: an expired offline grant cannot read its copy and erases it")
    } catch {
        check(false, "tracker: representative SQLite fixture can be stored and queried")
    }
}

private func fillTrackerFixture(_ store: TrackerReplicaStore, now: Date) throws {
    for batch in 0..<8 {
        let rows = (0..<100).map { trackerItemFixture("budget-\(100 * batch + $0)", "Tracker fixture " + String(repeating: "x", count: 80)) }
        let input = try store.state()
        let page = trackerSnapshotFixture(rows, cursor: batch == 7 ? "last" : nil,
                            more: batch < 7 ? "page-\(batch)" : nil, from: input.continuation)
        _ = try store.apply(TrackerReplicaPage.decode(page), expected: input, now: now)
    }
}
