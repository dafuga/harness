import Foundation

private let lifecycleScope = String(repeating: "c", count: 64)
private let lifecycleStamp = "2026-11-24T04:00:00Z"
private let lifecycleRevision = String(repeating: "b", count: 64)

private func lifecycleRow(_ id: String, status: String, flag: Bool, revision: Bool = true) -> [String: Any] {
    var row: [String: Any] = [
        "id": id, "title": "Lifecycle \(id)", "project": "Harness", "status": status,
        "updatedAt": lifecycleStamp, "notes": [], "runs": []
    ]
    if revision { row["attentionRevision"] = lifecycleRevision }
    if flag { row["flag"] = ["state": "open", "at": lifecycleStamp, "question": "Ship the fixture?"] }
    return row
}

private func lifecycleStore(_ rows: [[String: Any]]) throws -> TrackerReplicaStore {
    let store = TrackerReplicaStore(root: temporary("tracker-lifecycle"))
    store.enter(lifecycleScope)
    let page: [String: Any] = [
        "kind": "snapshot", "snapshotId": "lifecycle", "hubTime": lifecycleStamp, "partial": true,
        "rows": rows, "cursor": "seq-1", "continuation": NSNull(), "requestContinuation": NSNull()
    ]
    _ = try store.apply(TrackerReplicaPage.decode(page), expected: store.state(), now: Date())
    return store
}

/// The refusal a prepare returns, or nil when it is accepted.
private func refusal(_ store: TrackerReplicaStore, _ action: String, _ text: String,
                     id: String = "fixture001") -> TrackerReplicaWriteError? {
    do {
        _ = try store.prepareWrite(scope: lifecycleScope, action: action, input: ["id": id, "text": text])
        return nil
    } catch let error as TrackerReplicaWriteError {
        return error
    } catch {
        return .unavailable
    }
}

func trackerLifecycleWriteChecks() {
    do {
        let store = try lifecycleStore([
            lifecycleRow("fixture001", status: "open", flag: false),
            lifecycleRow("fixture002", status: "blocked", flag: true),
            lifecycleRow("fixture003", status: "open", flag: false, revision: false),
        ])
        let start = try store.prepareWrite(scope: lifecycleScope, action: "start",
                                           input: ["id": "fixture001", "text": ""])
        check(start.intent.action == "start" && start.intent.expectedStatus == "open"
              && start.intent.revision == lifecycleRevision && start.intent.text.isEmpty,
              "tracker lifecycle: start carries the shown status and attention revision, with no text")
        check(start.question == nil, "tracker lifecycle: start shows no flag question")
        let note = try store.prepareWrite(scope: lifecycleScope, action: "note",
                                          input: ["id": "fixture001", "text": "Plain note"])
        check(note.intent.expectedStatus == nil && note.intent.revision == nil,
              "tracker lifecycle: a note carries neither expected status nor revision")
        let object = try TrackerReplicaJSON.object(start.intent) as? [String: Any]
        check(object?["expectedStatus"] as? String == "open",
              "tracker lifecycle: the durable payload carries expectedStatus")
        let noteObject = try TrackerReplicaJSON.object(note.intent) as? [String: Any]
        check(noteObject?["expectedStatus"] == nil, "tracker lifecycle: a note payload omits expectedStatus")
        let legacy = #"{"version":1,"intentId":"00000000-0000-4000-8000-000000000001","itemId":"fixture001","action":"note","text":"Old","revision":null}"#
        let decoded = try TrackerReplicaJSON.decode(TrackerReplicaIntent.self, legacy)
        check(decoded.expectedStatus == nil, "tracker lifecycle: an intent queued before this change still decodes")
        check(refusal(store, "block", "") == .invalidInput && refusal(store, "ignore", "  ") == .invalidInput,
              "tracker lifecycle: block and ignore need a reason")
        check(refusal(store, "block", "Waiting on a key") == nil, "tracker lifecycle: block with a reason is accepted")
        check(refusal(store, "resolve", "") == .noFlag && refusal(store, "answer", "Yes") == .noFlag,
              "tracker lifecycle: resolve and answer need an open flag")
        check(refusal(store, "resolve", "", id: "fixture002") == nil,
              "tracker lifecycle: resolve on an open flag is accepted with no text")
        let resolve = try store.prepareWrite(scope: lifecycleScope, action: "resolve",
                                             input: ["id": "fixture002", "text": ""])
        check(resolve.question == "Ship the fixture?" && resolve.intent.expectedStatus == "blocked",
              "tracker lifecycle: resolve shows the exact flag and the blocked status it expects")
        check(refusal(store, "start", "", id: "fixture003") == .noReplica,
              "tracker lifecycle: a lifecycle action needs a replica revision")
        for action in ["remove", "add", "update", "create", "unflag"] {
            check(refusal(store, action, "x") == .invalidInput,
                  "tracker lifecycle: \(action) stays refused as an unknown phone action")
        }
        try store.enqueueWrite(start.intent)
        let queued = try store.nextWrite()
        check(queued?.expectedStatus == "open" && queued?.action == "start",
              "tracker lifecycle: the outbox returns the lifecycle intent with its expected status")
    } catch {
        check(false, "tracker lifecycle: store failed: \(error)")
    }
}
