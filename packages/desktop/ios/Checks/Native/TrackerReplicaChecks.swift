import Foundation

private let trackerMethod = "trackerReplicaPull"
private let stamp = "2026-11-23T12:00:00.000Z"

private func item(_ id: String, _ title: String = "Review Ünicode 100%") -> [String: Any] {
    return [
        "id": id, "title": title, "project": "Harness", "status": "in_progress", "updatedAt": stamp,
        "notes": [["id": "note-a", "author": "Fixture", "at": stamp, "text": "Reviewed"]],
        "flag": ["state": "open", "at": stamp, "question": "Which one?"],
        "runs": [["id": "1", "origin": "fixture", "state": "running", "queuedAt": 10]],
        "ignoredTransportField": "never persisted"
    ]
}

private func snapshot(_ rows: [[String: Any]], cursor: String? = nil, more: String? = nil) -> [String: Any] {
    return ["kind": "snapshot", "snapshotId": "fixture-snapshot", "hubTime": stamp, "partial": true,
            "rows": rows, "cursor": cursor as Any? ?? NSNull(), "continuation": more as Any? ?? NSNull()]
}

private func delta(_ before: String, _ after: String, more: Bool = false, rows: [[String: Any]] = []) -> [String: Any] {
    return ["kind": "delta", "requestCursor": before, "cursor": after, "hubTime": stamp,
            "partial": true, "hasMore": more, "operations": rows]
}

private func tool(_ bench: Bench, _ name: String, _ input: [String: Any] = [:]) -> [String: Any] {
    var value: [String: Any] = [:]
    bench.session.trackerTool(name, input: input) { value = $0 }
    bench.settle()
    return value
}

private func data(_ answer: [String: Any]) -> [String: Any] {
    return answer["data"] as? [String: Any] ?? [:]
}

private func next(_ bench: Bench, key: String, value: String) -> Bool {
    bench.settle()
    let call = bench.link.asked(trackerMethod).last?["input"] as? [String: Any]
    return call?[key] as? String == value
}

func trackerReplicaChecks() {
    let root = temporary("tracker")
    defer { try? FileManager.default.removeItem(at: root) }
    let bench = Bench(trackerRoot: root)
    bench.start()
    bench.attach(Bench.Answer(methods: Bench.methods + [trackerMethod]))
    let link = bench.link
    check(link.asked(trackerMethod).count == 1, "tracker: successful attach starts exactly one pull")
    let raw = bench.ask(trackerMethod)
    check(raw.failure?.code == "method-denied", "tracker: only the native replica can ask for wire data")
    bench.answer(link, trackerMethod, value: snapshot([item("fixture001")], more: "page-two"))
    check(next(bench, key: "continuation", value: "page-two"), "tracker: snapshot continuation is used")
    check(tool(bench, "tracker_status")["code"] as? String == "noReplica", "tracker: staged rows are invisible")
    bench.answer(link, trackerMethod, value: snapshot([item("fixture002", "Second item")], cursor: "seq-2"))
    check(next(bench, key: "cursor", value: "seq-2"), "tracker: final page commits and follows with delta")
    bench.answer(link, trackerMethod, value: delta("seq-2", "seq-2"))
    let status = tool(bench, "tracker_status")
    check(status["freshness"] as? String == "current", "tracker: terminal delta confirms freshness")
    check(data(status)["unresolvedFlags"] as? Int == 2, "tracker: both snapshot pages were committed together")

    let saved = bench.vault.record
    bench.close(link, .lost)
    let offline = Bench(record: saved, trackerRoot: root)
    offline.start()
    trackerOfflineChecks(offline)
    offline.attach(Bench.Answer())
    check(tool(offline, "tracker_status")["code"] as? String == "denied", "tracker: denied attach erases scope")
    let scopes = try? FileManager.default.contentsOfDirectory(atPath: root.path)
    check(scopes?.isEmpty == true, "tracker: no published database remains after grant removal")
    bench.disconnect()
}

private func trackerOfflineChecks(_ offline: Bench) {
    let saved = tool(offline, "tracker_show", ["id": "fixture001"])
    let shown = data(saved)
    check(saved["freshness"] as? String == "stale" && saved["lastSyncedAt"] as? String == stamp,
          "tracker: a restarted disconnected session reads the dated SQLite copy")
    check((shown["flag"] as? [String: String])?["state"] == "open", "tracker: show includes the flag")
    check((shown["notes"] as? [[String: Any]])?.first?["text"] as? String == "Reviewed", "tracker: show includes notes")
    check((shown["runs"] as? [[String: Any]])?.first?["state"] as? String == "running", "tracker: show includes runs")
    check(!String(describing: shown).contains("ignoredTransportField"), "tracker: only projected fields are retained")
    check(tool(offline, "tracker_show", ["id": "fixture"])["code"] as? String == "ambiguousPrefix",
          "tracker: prefix ambiguity is distinct from a missing item")
    check(tool(offline, "tracker_show", ["id": "unknown"])["code"] as? String == "noLocalMatch",
          "tracker: missing item is distinct from an empty replica")
    let matches = data(tool(offline, "tracker_search", ["query": "ÜNICODE", "status": "in_progress", "limit": 1]))
    check((matches["items"] as? [[String: Any]])?.first?["id"] as? String == "fixture001",
          "tracker: search folds case and supports status and limit")
    let literal = data(tool(offline, "tracker_search", ["query": "%"]))
    check((literal["items"] as? [[String: Any]])?.count == 1, "tracker: search treats wildcard characters literally")
    check(offline.link.asked(trackerMethod).isEmpty, "tracker: offline tools generate no network requests")
}

func trackerCursorAndBackgroundChecks() {
    let root = temporary("tracker-background")
    let bench = Bench(trackerRoot: root)
    defer { bench.disconnect(); try? FileManager.default.removeItem(at: root) }
    bench.start()
    bench.attach(Bench.Answer(methods: [trackerMethod]))
    bench.answer(bench.link, trackerMethod, value: snapshot([item("fixture001")], cursor: "seq-1"))
    check(next(bench, key: "cursor", value: "seq-1"), "tracker: cursor persisted with published snapshot")
    bench.answer(bench.link, trackerMethod, value: delta("wrong", "seq-2", rows: [["id": "fixture001", "row": NSNull()]]))
    check(data(tool(bench, "tracker_show", ["id": "fixture001"]))["item"] != nil,
          "tracker: a response for the wrong cursor cannot delete an item")
    let link = bench.link
    bench.session.setTrackerForeground(false)
    bench.settle()
    check(link.closed, "tracker: foreground socket is closed on background entry")
    var completions = 0
    bench.session.beginTrackerBackground { _ in completions += 1 }
    bench.settle()
    bench.attach(Bench.Answer(methods: [trackerMethod]))
    let background = bench.link
    check(next(bench, key: "cursor", value: "seq-1"), "tracker: background uses the last committed cursor")
    bench.answer(background, trackerMethod, value: delta("seq-1", "seq-2", more: true))
    check(next(bench, key: "cursor", value: "seq-2"), "tracker: background applies the first valid page")
    bench.session.expireTrackerBackground()
    bench.settle()
    bench.answer(background, trackerMethod, value: delta("seq-2", "seq-3"))
    check(background.closed && completions == 1, "tracker: expiration closes the socket and completes once")
    let cursor = bench.session.queue.sync { try? bench.session.trackerStore.state().cursor }
    check(cursor == "seq-2", "tracker: a late page cannot advance the cursor after expiration")
}
