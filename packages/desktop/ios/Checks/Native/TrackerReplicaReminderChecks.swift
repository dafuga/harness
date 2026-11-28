import Foundation

/// A personal reminder is listed by its next time, and its Done and Snooze name the shown copy.
private func trackerReminderChecks(_ store: TrackerReplicaStore, scope: String) throws {
    var later = trackerItemFixture("reminder02", "Later sample")
    later["reminder"] = ["at": "2026-11-30T10:00:00.000Z"]
    var sooner = trackerItemFixture("reminder01", "Sooner sample")
    sooner["reminder"] = ["at": "2026-11-29T10:00:00.000Z", "repeats": "Weekly"]
    sooner["attentionRevision"] = String(repeating: "b", count: 64)
    let page = trackerSnapshotFixture([later, sooner, trackerItemFixture("fixture001")], cursor: "seq-1")
    _ = try store.apply(TrackerReplicaPage.decode(page), expected: store.state(), now: Date())
    let status = trackerDataFixture(store.tool("tracker_status", input: [:], online: false, now: Date()))
    let listed = (status["reminders"] as? [[String: Any]])?.compactMap { $0["id"] as? String }
    check(listed == ["reminder01", "reminder02"], "tracker reminders: only reminders, soonest first")
    let done = try store.prepareWrite(scope: scope, action: "done", input: ["id": "reminder01", "text": ""]).intent
    check(done.revision == String(repeating: "b", count: 64) && done.expectedStatus == "in_progress",
          "tracker reminders: done names the copy and status shown")
    let until = "2026-11-30T09:00:00.000Z"
    let snooze = try store.prepareWrite(scope: scope, action: "remind", input: ["id": "reminder01", "text": until])
    check(snooze.intent.text == until, "tracker reminders: snooze carries the new time")
}

func trackerReminderStoreChecks() {
    let root = temporary("tracker-reminders")
    defer { try? FileManager.default.removeItem(at: root) }
    let scope = String(repeating: "a", count: 64)
    let store = TrackerReplicaStore(root: root)
    store.enter(scope)
    do {
        try trackerReminderChecks(store, scope: scope)
    } catch {
        check(false, "tracker reminders: failed: \(error)")
    }
}
