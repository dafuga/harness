import Foundation

func trackerWriteSessionChecks() {
    let root = temporary("tracker-write-session")
    defer { try? FileManager.default.removeItem(at: root) }
    let pull = "trackerReplicaPull", push = "trackerReplicaPush"
    let methods = Bench.methods + [pull, push]
    let bench = Bench(trackerRoot: root)
    bench.start()
    bench.attach(Bench.Answer(methods: methods))
    let stamp = "2026-11-23T12:00:00Z"
    let revision = String(repeating: "a", count: 64)
    let row: [String: Any] = [
        "id": "fixture001", "title": "A staged question", "project": "Harness", "status": "open",
        "notes": [], "runs": [], "attentionRevision": revision,
        "flag": ["state": "open", "at": stamp, "question": "Which fixture?"]
    ]
    bench.answer(bench.link, pull, value: [
        "kind": "snapshot", "snapshotId": "stage", "hubTime": stamp, "partial": true,
        "rows": [row], "cursor": "seq-1", "continuation": NSNull(), "requestContinuation": NSNull()
    ])
    let raw = bench.ask(push)
    check(raw.failure?.code == "method-denied", "tracker write: the generic bridge refuses raw pushes")
    var review: TrackerReplicaConfirmation?
    bench.session.prepareTrackerWrite("answer", input: ["id": "fixture001", "text": "The isolated fixture", "revision": revision]) {
        review = try? $0.get()
    }
    bench.settle()
    check(review?.question == "Which fixture?" && bench.link.asked(push).isEmpty,
          "tracker write: the exact question is shown before sending anything")
    guard let review = review else { return }
    bench.session.confirmTrackerWrite(review) { _ in }
    bench.settle()
    let initial = bench.link.asked(push).last?["input"] as? [String: Any]
    check(initial?["intentId"] as? String == review.intent.intentId && initial?["revision"] as? String == revision,
          "tracker write: confirmation sends the durable intent under its reviewed revision")
    var stale: TrackerReplicaWriteError?
    bench.session.prepareTrackerWrite("answer", input: ["id": "fixture001", "text": "Late", "revision": "stale"]) {
        if case .failure(let error) = $0 { stale = error }
    }
    bench.settle()
    check(stale == .staleReview, "tracker write: a changed flag needs a fresh review before an answer")
    let saved = bench.vault.record
    bench.close(bench.link, .lost)
    let restarted = Bench(record: saved, trackerRoot: root)
    restarted.start()
    restarted.attach(Bench.Answer(epoch: "epoch-2", methods: methods))
    let retry = restarted.link.asked(push).last?["input"] as? [String: Any]
    check(retry?["intentId"] as? String == review.intent.intentId && retry?["epoch"] as? String == "epoch-2",
          "tracker write: an interrupted write replays after relaunch with its original identity")
    restarted.answer(restarted.link, push, value: ["intentId": review.intent.intentId, "status": "accepted"])
    var pending: [[String: String]]?
    restarted.session.trackerTool("tracker_write_status", input: [:]) {
        pending = ($0["data"] as? [String: Any])?["writes"] as? [[String: String]]
    }
    restarted.settle()
    check(pending?.count == 1 && pending?.first?["status"] == "accepted",
          "tracker write: the accepted receipt is kept as acknowledged, not pending")
    restarted.disconnect()
}
