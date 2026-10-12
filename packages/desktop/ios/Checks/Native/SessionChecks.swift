import Foundation

// The rules of a session, checked on the real `RemoteSession`, `RemoteRequests` and `RemoteCache`.

func attachChecks() {
    let bench = Bench()
    bench.start()
    check(bench.state == "connecting", "a paired phone is connecting until the computer attached it")
    let early = bench.ask("snapshot")
    check(early.failure?.code == "method-denied", "nothing may be asked before a computer attached this phone")
    let partial = ["listProjects", "snapshot", "entity", "openProject", "remote.enable"]
    bench.attach(Bench.Answer(methods: partial, locked: true))
    check(bench.state == "online", "the attach answer makes the computer online")
    let methods = bench.status["methods"] as? [String] ?? []
    check(methods == ["listProjects", "snapshot", "entity"], "only attached device methods are offered, never a desktop one")
    check(bench.status["locked"] as? Bool == true, "a lock state the computer reported is stated")
    let denied = bench.ask("startRun")
    check(denied.failure?.code == "method-denied" && bench.link.asked("startRun").isEmpty, "a method that was not attached is refused and never sent")
    #if DEBUG
    check(bench.status["fixture"] == nil, "a Debug build that was not started for a fixture does not say it is one")
    RemoteDebug.loopback = true
    check(bench.status["fixture"] as? Bool == true, "a Debug build started for a fixture says so in its status")
    RemoteDebug.loopback = false
    #else
    check(bench.status["fixture"] == nil, "Release never states a fixture build")
    #endif
    let named = String(describing: bench.status)
    let secret = bench.vault.record?.credential ?? "-"
    check(!named.contains(secret) && bench.status["credential"] == nil, "the status holds no credential")
}

func lockChecks() {
    let bench = Bench()
    bench.online()
    check(bench.status["locked"] == nil, "a lock state the computer did not report stays unknown")
    bench.event(bench.link, "connection", 1, ["kind": "host", "state": "locked"])
    check(bench.state == "online" && bench.status["locked"] as? Bool == true, "a locked computer stays online")
    bench.event(bench.link, "connection", 2, ["kind": "host", "state": "unlocked"])
    check(bench.status["locked"] as? Bool == false, "an unlocked computer is stated as unlocked")
    bench.event(bench.link, "connection", 3, ["kind": "host", "state": "suspending"])
    check(bench.state == "offline" && bench.status["locked"] == nil, "a computer going to sleep is offline and has no lock state")
}

func staleChecks() {
    let bench = Bench()
    bench.online()
    let old = bench.link
    bench.close(old, .lost)
    check(bench.state == "offline" && old.closed, "a lost link is offline at once")
    bench.reconnect()
    let current = bench.link
    check(current !== old && bench.state == "connecting", "a new link replaces the lost one")
    let sent = old.sent.count
    bench.ready(old)
    let value = bench.attachment(epoch: "stale", methods: Bench.methods, grant: Bench.grant, locked: nil)
    bench.deliver(old, ["type": "response", "id": old.asked("session.attach").last?["id"] ?? "", "ok": true, "value": value])
    bench.event(old, "run", 9, ["runId": "run-1", "kind": "cancelled"])
    check(bench.state == "connecting" && old.sent.count == sent && current.sent.isEmpty, "a callback of the old link restores nothing and sends nothing")
    check(bench.events.isEmpty, "an event of the old link is not handed to the page")
    bench.close(old, .revoked)
    check(bench.vault.record != nil && bench.state == "connecting", "a late revocation of the old link does not wipe the pairing")

    let gone = Bench()
    gone.online()
    let before = gone.link
    gone.disconnect()
    let made = gone.links.count
    let told = gone.statuses.count
    gone.ready(before)
    gone.close(before, .lost)
    gone.event(before, "run", 3, ["runId": "run-1", "kind": "cancelled"])
    check(gone.state == "unpaired" && gone.links.count == made && gone.statuses.count == told, "after a disconnect an old callback changes nothing and opens nothing")
    check(gone.vault.record == nil && gone.events.isEmpty, "after a disconnect nothing is kept and nothing is delivered")
}

func revoked(_ bench: Bench, _ name: String) {
    check(bench.state == "revoked", "\(name): the phone says its access was removed")
    check(bench.vault.record == nil && bench.vault.wipes > 0, "\(name): the credential and keys leave the vault")
    check(entries(bench.root) == 0, "\(name): every saved copy is purged")
    check((bench.status["methods"] as? [String] ?? ["x"]).isEmpty, "\(name): nothing is offered any more")
}

func revocationChecks() {
    let closed = Bench()
    closed.online()
    let link = closed.link
    _ = closed.ask("snapshot")
    closed.answer(link, "snapshot", value: ["project": ["id": "local-1"]])
    check(entries(closed.root) == 1, "an answered read is kept while the pairing holds")
    let pending = closed.ask("entity", ["projectId": "local-1", "entityId": "page:a"])
    closed.close(link, .revoked)
    revoked(closed, "socket closed as unauthorized")
    check(pending.failure != nil, "a read that waited is failed, not answered")
    closed.answer(link, "entity", value: ["id": "page:a"])
    check(entries(closed.root) == 0, "an answer that arrives after the revocation is not kept")

    let refused = Bench()
    refused.start()
    refused.ready(refused.link)
    let id = refused.link.asked("session.attach").last?["id"] ?? ""
    refused.deliver(refused.link, ["type": "response", "id": id, "ok": false, "error": ["code": "revoked", "message": "No longer approved."]])
    revoked(refused, "attach refused as revoked")

    let told = Bench()
    told.online()
    told.event(told.link, "connection", 1, ["kind": "revoked"])
    revoked(told, "revoked event")
    check(told.events.isEmpty, "a revocation is not handed on as an ordinary event")
}

func mutationChecks() {
    let bench = Bench()
    bench.online()
    let first = bench.link
    let change = bench.ask("startRun", ["projectId": "local-1", "text": "check"])
    let read = bench.ask("entity", ["projectId": "local-1", "entityId": "page:a"])
    let readId = first.asked("entity").last?["id"] as? String
    bench.close(first, .lost)
    check(change.failure?.message == RemoteFailure.uncertain.message, "a change pending when the link is lost ends as uncertain")
    check(read.result == nil, "a read pending when the link is lost keeps waiting")
    let offline = bench.ask("addComment", ["projectId": "local-1", "text": "check"])
    check(offline.failure?.code == "offline" && first.asked("addComment").isEmpty, "a change asked while offline is refused and never queued")
    bench.reconnect()
    bench.attach(Bench.Answer(epoch: "epoch-2"))
    let second = bench.link
    check(second.methods == ["session.attach", "entity"], "after a reconnect under a new epoch only the read is sent again")
    check(second.asked("entity").last?["id"] as? String == readId, "the read keeps its first id")
    check(second.asked("startRun").isEmpty && second.asked("addComment").isEmpty, "no change is sent again by itself")
    bench.answer(second, "entity", value: ["id": "page:a"])
    check(read.answer != nil && read.answer?.cachedAt == nil, "the read is answered by the computer, not by a copy")

    let asleep = Bench()
    asleep.online()
    let waiting = asleep.ask("approve", ["projectId": "local-1"])
    asleep.event(asleep.link, "connection", 1, ["kind": "host", "state": "suspending"])
    check(waiting.failure?.message == RemoteFailure.uncertain.message, "a change pending when the computer goes to sleep ends as uncertain")
    let away = Bench()
    away.online()
    let held = away.ask("createPlan", ["projectId": "local-1"])
    away.close(away.link, .hostOffline)
    check(held.failure?.message == RemoteFailure.uncertain.message && away.state == "offline", "a change pending when the relay loses the computer ends as uncertain")
}

/// The waiting list itself: whatever a session does, it never hands a change out to be re-sent.
func requestChecks() {
    let queue = DispatchQueue(label: "harness.check.requests")
    let requests = RemoteRequests(queue: queue)
    var ended: [String] = []
    _ = requests.add(method: "entity", input: ["projectId": "local-1"]) { _ in ended.append("entity") }
    _ = requests.add(method: "startRun", input: ["projectId": "local-1"]) { _ in ended.append("startRun") }
    let again = requests.unanswered.compactMap { RemoteCoding.object($0)?["method"] as? String }
    check(again == ["entity"], "the list of what is sent again holds reads only, also while a change still waits")
    requests.failChanges(.uncertain)
    check(ended == ["startRun"], "ending the changes leaves the reads waiting")
    var full = 0
    for _ in 0..<RemoteLimits.pendingRequests where (try? requests.add(method: "entity", input: [:]) { _ in }.get()) == nil { full += 1 }
    check(full == 1, "no more requests wait than the protocol allows")
    let large = String(repeating: "x", count: RemoteLimits.requestBytes)
    requests.failAll(.offline)
    var refused = false
    if case .failure(let failure) = requests.add(method: "addComment", input: ["text": large], done: { _ in }) { refused = failure.code == "too-large" }
    check(refused, "a request above the size of the protocol is refused before it is sent")
}
