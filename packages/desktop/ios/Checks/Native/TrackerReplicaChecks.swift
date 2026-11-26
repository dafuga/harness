import Foundation

private let trackerMethod = "trackerReplicaPull"
private let stamp = "2026-11-23T12:00:00.000Z"

func trackerItemFixture(_ id: String, _ title: String = "Review Ünicode 100%") -> [String: Any] {
    return [
        "id": id, "title": title, "project": "Harness", "status": "in_progress", "updatedAt": stamp,
        "notes": [["id": "note-a", "author": "Fixture", "at": stamp, "text": "Reviewed"]],
        // Only a structured ask counts as "needs you": two to four choices, one recommended.
        "flag": ["state": "open", "at": stamp, "question": "Which one?", "options": [
            ["label": "First", "effect": "Continues", "recommended": true],
            ["label": "Second", "effect": "Waits"]
        ]],
        "runs": [["id": "1", "origin": "fixture", "state": "running", "queuedAt": 10]],
        "stage": "detail",
        "planning": [
            "artifacts": ["detail": ["summary": "Main page designs"]],
            "promotions": [["stage": "detail", "by": "Fixture", "at": stamp]]
        ],
        "ignoredTransportField": "never persisted"
    ]
}

func trackerSnapshotFixture(
    _ rows: [[String: Any]], cursor: String? = nil, more: String? = nil, from: String? = nil
) -> [String: Any] {
    return ["kind": "snapshot", "snapshotId": "fixture-snapshot", "hubTime": stamp, "partial": true,
            "rows": rows, "cursor": cursor as Any? ?? NSNull(), "continuation": more as Any? ?? NSNull(),
            "requestContinuation": from as Any? ?? NSNull()]
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

func trackerDataFixture(_ answer: [String: Any]) -> [String: Any] {
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
    bench.answer(link, trackerMethod, value: trackerSnapshotFixture([trackerItemFixture("fixture001")], more: "page-two"))
    check(next(bench, key: "continuation", value: "page-two"), "tracker: snapshot continuation is used")
    check(tool(bench, "tracker_status")["code"] as? String == "noReplica", "tracker: staged rows are invisible")
    bench.answer(link, trackerMethod, value: trackerSnapshotFixture([trackerItemFixture("fixture002", "Second item")], cursor: "seq-2", from: "page-two"))
    check(next(bench, key: "cursor", value: "seq-2"), "tracker: final page commits and follows with delta")
    bench.answer(link, trackerMethod, value: delta("seq-2", "seq-2"))
    let status = tool(bench, "tracker_status")
    check(status["freshness"] as? String == "current", "tracker: terminal delta confirms freshness")
    check(trackerDataFixture(status)["unresolvedFlags"] as? Int == 2, "tracker: both snapshot pages were committed together")
    check(tool(bench, "tracker_write_status")["code"] as? String == "denied",
          "tracker: the replica read grant cannot access the write outbox")

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
    let shown = trackerDataFixture(saved)
    check(saved["freshness"] as? String == "stale" && saved["lastSyncedAt"] as? String == stamp,
          "tracker: a restarted disconnected session reads the dated SQLite copy")
    let planning = shown["planning"] as? [String: Any]
    let artifacts = planning?["artifacts"] as? [String: [String: String]]
    check((shown["item"] as? [String: String])?["stage"] == "detail", "tracker: show includes the stage")
    check(artifacts?["detail"]?["summary"] == "Main page designs", "tracker: retains the planning artifact offline")
    check((planning?["promotions"] as? [[String: String]])?.first?["by"] == "Fixture",
          "tracker: retains promotion attribution offline")
    check((shown["flag"] as? [String: Any])?["state"] as? String == "open", "tracker: show includes the flag")
    check((shown["notes"] as? [[String: Any]])?.first?["text"] as? String == "Reviewed", "tracker: show includes notes")
    check((shown["runs"] as? [[String: Any]])?.first?["state"] as? String == "running", "tracker: show includes runs")
    check(!String(describing: shown).contains("ignoredTransportField"), "tracker: only projected fields are retained")
    check(tool(offline, "tracker_show", ["id": "fixture"])["code"] as? String == "ambiguousPrefix",
          "tracker: prefix ambiguity is distinct from a missing item")
    check(tool(offline, "tracker_show", ["id": "unknown"])["code"] as? String == "noLocalMatch",
          "tracker: missing item is distinct from an empty replica")
    let matches = trackerDataFixture(tool(offline, "tracker_search", ["query": "ÜNICODE", "status": "in_progress", "limit": 1]))
    check((matches["items"] as? [[String: Any]])?.first?["id"] as? String == "fixture001",
          "tracker: search folds case and supports status and limit")
    let literal = trackerDataFixture(tool(offline, "tracker_search", ["query": "%"]))
    check((literal["items"] as? [[String: Any]])?.count == 1, "tracker: search treats wildcard characters literally")
    check(offline.link.asked(trackerMethod).isEmpty, "tracker: offline tools generate no network requests")
}

func trackerCursorAndBackgroundChecks() {
    let root = temporary("tracker-background")
    let bench = Bench(trackerRoot: root)
    defer { bench.disconnect(); try? FileManager.default.removeItem(at: root) }
    bench.start()
    bench.attach(Bench.Answer(methods: [trackerMethod]))
    bench.answer(bench.link, trackerMethod, value: trackerSnapshotFixture([trackerItemFixture("fixture001")], cursor: "seq-1"))
    check(next(bench, key: "cursor", value: "seq-1"), "tracker: cursor persisted with published snapshot")
    bench.answer(bench.link, trackerMethod, value: delta("wrong", "seq-2", rows: [["id": "fixture001", "row": NSNull()]]))
    check(trackerDataFixture(tool(bench, "tracker_show", ["id": "fixture001"]))["item"] != nil,
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

func trackerWriteOutboxChecks() {
    let root = temporary("tracker-outbox")
    defer { try? FileManager.default.removeItem(at: root) }
    let scope = String(repeating: "a", count: 64)
    let store = TrackerReplicaStore(root: root)
    store.enter(scope)
    var stage = "snapshot"
    do {
        let initial = trackerSnapshotFixture([trackerItemFixture("fixture001"), trackerItemFixture("fixture002")], cursor: "seq-1")
        _ = try store.apply(TrackerReplicaPage.decode(initial), expected: store.state(), now: Date())
        stage = "prepare confirmation"
        let first = try store.prepareWrite(scope: scope, action: "note", input: ["id": "fixture001", "text": "Draft"])
        stage = "read empty outbox"
        let pending = try store.writeStatus()
        check(pending.isEmpty, "tracker write: preparing confirmation enqueues nothing")
        stage = "insert first intent"
        try store.enqueueWrite(first.intent)
        let later = try store.prepareWrite(scope: scope, action: "note", input: ["id": "fixture001", "text": "Later"])
        try store.enqueueWrite(later.intent)
        let other = try store.prepareWrite(scope: scope, action: "note", input: ["id": "fixture002", "text": "Other"])
        try store.enqueueWrite(other.intent)
        let restarted = TrackerReplicaStore(root: root)
        restarted.enter(scope)
        let recovered = try restarted.nextWrite()
        check(recovered?.intentId == first.intent.intentId, "tracker write: relaunch preserves the first device intent")
        let shown = restarted.tool("tracker_show", input: ["id": "fixture001"], online: false, now: Date())
        check(!String(describing: shown).contains("Draft"), "tracker write: queued text is absent from canonical reads")
        try restarted.finishWrite(first.intent, conflict: "attention")
        let eligible = try restarted.nextWrite()
        check(eligible?.intentId == other.intent.intentId, "tracker write: conflict blocks only the matching item")
        try restarted.finishWrite(other.intent, conflict: nil)
        let blocked = try restarted.nextWrite()
        check(blocked == nil, "tracker write: same-item intents cannot bypass a conflict")
        let review = try restarted.prepareDiscard(scope: scope, input: ["intentId": first.intent.intentId])
        try restarted.discardConflict(review.intent)
        let unblocked = try restarted.nextWrite()
        check(unblocked?.intentId == later.intent.intentId, "tracker write: discarding the conflict releases later intents")
        let receipts = try (0..<21).map { _ in
            let intent = try restarted.prepareWrite(scope: scope, action: "note", input: ["id": "fixture002", "text": "Receipt"]).intent
            try restarted.enqueueWrite(intent)
            return intent
        }
        for intent in receipts { try restarted.finishWrite(intent, conflict: nil) }
        let accepted = try restarted.writeStatus().filter { $0["status"] == "accepted" }
        check(accepted.compactMap { $0["intentId"] } == receipts.suffix(20).map(\.intentId), "tracker write: retain only the newest 20 acknowledged intents")
        try restarted.purgeWrites()
        let erased = try restarted.writeStatus()
        check(erased.isEmpty, "tracker write: revocation discards outbox payloads")
    } catch {
        check(false, "tracker write: outbox failed at \(stage): \(error)")
    }
}
