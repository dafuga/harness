import Foundation

private let pull = "trackerReplicaPull"
private let stamp = "2026-11-23T12:00:00.000Z"

private func delta(_ before: String, _ after: String, rows: [[String: Any]] = []) -> [String: Any] {
    return ["kind": "delta", "requestCursor": before, "cursor": after, "hubTime": stamp,
            "partial": true, "hasMore": false, "operations": rows]
}

private func changedRow(_ title: String) -> [[String: Any]] {
    return [["id": "fixture001", "row": trackerItemFixture("fixture001", title)]]
}

/// A paired phone that follows a doorbell, and what its page was told.
private final class LiveBench {
    let bench: Bench
    let bell: DoorbellBench
    private var told: [[String: Any]] = []

    init(_ root: URL) {
        bench = Bench(trackerRoot: root)
        bell = DoorbellBench(queue: bench.session.queue)
        bench.session.onTrackerChange = { [weak self] in self?.told.append($0) }
        bench.session.useTrackerDoorbell(bell.bell)
        bench.start()
        bench.attach(Bench.Answer(methods: Bench.methods + [pull]))
        bell.settle()
    }

    var pulls: Int { bench.link.asked(pull).count }
    var events: [[String: Any]] { bench.session.queue.sync { told } }
    var changes: Int { events.filter { $0["changed"] as? Bool == true }.count }
    var shown: String? { events.last?["state"] as? String }

    var pushed: String? {
        var answer: [String: Any] = [:]
        bench.session.trackerPush { answer = $0 }
        bench.settle()
        return answer["state"] as? String
    }

    func reply(_ page: [String: Any]) {
        bench.answer(bench.link, pull, value: page)
        bell.settle()
    }

    /// The first copy: a snapshot, then the empty delta that confirms it.
    func catchUp() {
        reply(trackerSnapshotFixture([trackerItemFixture("fixture001")], cursor: "seq-1"))
        reply(delta("seq-1", "seq-1"))
    }
}

private func noticeChecks(_ live: LiveBench) {
    live.catchUp()
    check(live.bell.count == 1, "live: a paired phone with the tracker grant opens the account socket")
    check(live.changes >= 1 && live.pushed == "reconnecting",
          "live: the first copy is announced, and nothing is called live before the socket opens")
    var before = live.pulls
    live.bell.say(.opened)
    check(live.pushed == "live" && live.shown == "live", "live: an open socket and an online computer are live")
    check(live.pulls == before + 1, "live: connecting pulls at once")
    var changes = live.changes
    live.reply(delta("seq-1", "seq-1"))
    check(live.changes == changes + 1, "live: the first pull after a gap tells the page, even when nothing moved")

    before = live.pulls
    changes = live.changes
    live.bell.notice("home")
    check(live.pulls == before + 1, "live: a notice pulls without waiting for the 60 s timer")
    live.reply(delta("seq-1", "seq-2", rows: changedRow("Changed title")))
    check(live.changes == changes + 1, "live: an applied change is pushed to the page")

    before = live.pulls
    changes = live.changes
    live.bell.notice("home")
    live.reply(delta("seq-2", "seq-2"))
    check(live.changes == changes, "live: an empty pull tells the page nothing")
}

private func flightChecks(_ live: LiveBench) {
    let before = live.pulls
    live.bell.notice("home")
    live.bell.notice("home")
    live.bell.notice("home")
    check(live.pulls == before + 1, "live: only one pull is in flight")
    live.reply(delta("seq-2", "seq-2"))
    check(live.pulls == before + 2, "live: notices during a pull ask for exactly one more, so none is lost")
    live.reply(delta("seq-2", "seq-3", rows: changedRow("Second change")))
    check(live.pulls == before + 2, "live: after that the phone waits again")
}

private func lifecycleChecks(_ live: LiveBench) {
    live.bell.say(.closed)
    check(live.pushed == "reconnecting" && live.shown == "reconnecting", "live: a lost socket says reconnecting")
    check(wait { live.bell.count == 2 }, "live: and reopens")
    live.bell.say(.opened)
    live.reply(delta("seq-3", "seq-3"))
    check(live.pushed == "live", "live: it is live again after the reconnect pull")

    live.bench.close(live.bench.link, .hostOffline)
    check(live.pushed == "reconnecting", "live: an unreachable computer is not live, whatever the socket says")

    live.bench.session.setTrackerForeground(false)
    live.bell.settle()
    check(live.bell.socket!.closed && !live.bell.live, "live: a hidden app holds no socket")
    let opened = live.bell.count
    live.bench.session.setTrackerForeground(true)
    live.bell.settle()
    check(live.bell.count == opened + 1, "live: coming back to the front opens it again")

    let changes = live.changes
    live.bench.disconnect()
    live.bell.settle()
    check(live.bell.socket!.closed, "live: forgetting the computer closes the socket")
    check(live.changes > changes, "live: and the page is told to read the emptied copy")
}

func trackerLiveChecks() {
    let root = temporary("tracker-live")
    defer { try? FileManager.default.removeItem(at: root) }
    let live = LiveBench(root)
    noticeChecks(live)
    flightChecks(live)
    lifecycleChecks(live)
}
