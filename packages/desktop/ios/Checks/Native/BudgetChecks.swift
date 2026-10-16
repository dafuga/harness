import Foundation

// The budget of the saved copies, the epoch a change carries, and what a refusal ends: checked
// on the real `RemoteCache`, `RemoteCacheIndex` and `RemoteSession`.

private func input(_ number: Int) -> [String: Any] {
    ["projectId": "local-1", "entityId": "page:\(number)"]
}
private func value(_ number: Int, padding: Int = 0) -> [String: Any] {
    ["id": "page:\(number)", "text": String(repeating: "x", count: padding)]
}
private func kept(_ cache: RemoteCache, _ numbers: [Int]) -> [Int] {
    numbers.filter { cache.read(scope: "scope", method: "entity", input: input($0)) != nil }
}

func budgetChecks() {
    let root = temporary("budget")
    let cache = RemoteCache(root: root, budget: RemoteCacheBudget(entries: 3, bytes: 1_000_000))
    cache.enter("scope")
    for number in 1...3 { cache.save(scope: "scope", method: "entity", input: input(number), value: value(number)) }
    check(cache.read(scope: "scope", method: "entity", input: input(1)) != nil, "a copy inside the budget is kept")
    cache.save(scope: "scope", method: "entity", input: input(4), value: value(4))
    check(entries(root) == 3 && cache.usage.entries == 3, "a write beyond the budget of copies evicts at once, not at the next start")
    check(kept(cache, [1, 2, 3, 4]) == [1, 3, 4], "the copy that was not used for longest leaves; one that was just read stays")
    for number in 5...40 { cache.save(scope: "scope", method: "entity", input: input(number), value: value(number)) }
    check(entries(root) == 3 && kept(cache, [38, 39, 40]) == [38, 39, 40], "steady writes never exceed the budget and keep the newest reads")

    let reopened = RemoteCache(root: root, budget: RemoteCacheBudget(entries: 2, bytes: 1_000_000))
    reopened.enter("scope")
    check(entries(root) == 2 && reopened.usage.entries == 2, "a smaller budget is enforced on what is found on disk")

    let sized = temporary("bytes")
    let small = RemoteCache(root: sized, budget: RemoteCacheBudget(entries: 100, bytes: 6_000))
    small.enter("scope")
    for number in 1...5 { small.save(scope: "scope", method: "entity", input: input(number), value: value(number, padding: 2_000)) }
    check(small.usage.bytes <= 6_000 && entries(sized) == 2, "the total bytes of the copies stay inside the budget")
    check(kept(small, [1, 2, 3, 4, 5]) == [4, 5], "the oldest reads leave first when bytes run out")
    small.save(scope: "scope", method: "entity", input: input(6), value: value(6, padding: 9_000))
    check(kept(small, [6]).isEmpty && kept(small, [4, 5]) == [4, 5], "a copy larger than the whole budget is not kept and evicts nothing")

    let bench = Bench(budget: RemoteCacheBudget(entries: 2, bytes: 1_000_000))
    bench.online()
    for number in 1...6 {
        _ = bench.ask("entity", input(number))
        bench.answer(bench.link, "entity", value: value(number))
    }
    check(entries(bench.root) == 2, "a long connected session stays inside the budget while it reads")
    check(bench.vault.record != nil && bench.state == "online", "evicting copies touches neither the pairing nor the connection")
}

func epochChecks() {
    let bench = Bench()
    bench.online()
    _ = bench.ask("entity", input(1))
    _ = bench.ask("startRun", ["projectId": "local-1", "text": "check"])
    let read = bench.link.asked("entity").last?["input"] as? [String: Any]
    let change = bench.link.asked("startRun").last?["input"] as? [String: Any]
    check(change?["epoch"] as? String == "epoch-1", "a change names the epoch of the attach it was asked under")
    check(read?["epoch"] == nil, "a read names no epoch")
    bench.close(bench.link, .lost)
    bench.reconnect()
    bench.attach(Bench.Answer(epoch: "epoch-2"))
    _ = bench.ask("addComment", ["projectId": "local-1", "text": "check"])
    let later = bench.link.asked("addComment").last?["input"] as? [String: Any]
    check(later?["epoch"] as? String == "epoch-2", "a change asked after a new attach names the new epoch")
    check(bench.link.asked("startRun").isEmpty, "the change of the earlier epoch is not sent under the new one")
}

func refusalChecks() {
    let bench = Bench()
    bench.online()
    let waiting = bench.ask("entity", input(1))
    let change = bench.ask("startRun", ["projectId": "local-1", "text": "check"])
    _ = bench.ask("snapshot")
    let id = bench.link.asked("snapshot").last?["id"] ?? ""
    bench.deliver(bench.link, ["type": "response", "id": id, "ok": false, "error": ["code": "project-denied", "message": "No."]])
    check(waiting.failure?.message == RemoteFailure.superseded.message, "a refusal of the computer ends the reads that still waited")
    check(change.result == nil, "a change that waits is not ended by a refusal of another request")
    bench.answer(bench.link, "entity", value: value(1))
    check(waiting.answer == nil && entries(bench.root) == 0, "the late answer of an ended read reaches neither page nor cache")
    let expired = Bench()
    expired.online()
    let old = expired.ask("approve", ["projectId": "local-1"])
    let approveId = expired.link.asked("approve").last?["id"] ?? ""
    expired.deliver(expired.link, ["type": "response", "id": approveId, "ok": false, "error": ["code": "request-expired", "message": "This change may already have been made. Reload before trying again."]])
    check(old.failure?.code == "request-expired" && expired.state == "online", "an expired change is reported with the words of the computer and is not repeated")
    check(expired.link.asked("approve").count == 1, "nothing is sent again after request-expired")
}
