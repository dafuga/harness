import CryptoKit
import Foundation

// The saved copies of a phone, checked on the real `RemoteCache` through a real session.

private let snapshotInput: [String: Any] = ["projectId": "local-1", "branch": "main", "commit": NSNull()]
private let snapshotValue: [String: Any] = ["project": ["id": "local-1", "name": "One"], "writable": true]

private func media(_ bytes: [UInt8], hash: String? = nil) -> [String: Any] {
    let data = Data(bytes)
    let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    return [
        "encoding": "base64", "mediaType": "image/png", "byteLength": data.count, "sha256": hash ?? digest,
        "data": data.base64EncodedString()
    ]
}

/// A session that read one snapshot while the computer was online.
private func read() -> Bench {
    let bench = Bench()
    bench.online()
    let reply = bench.ask("snapshot", snapshotInput)
    bench.answer(bench.link, "snapshot", value: snapshotValue)
    check(reply.answer != nil && reply.answer?.cachedAt == nil, "an answer of the computer is not called a copy")
    return bench
}

func savedCopyChecks() {
    let bench = read()
    _ = bench.ask("pendingComments")
    bench.answer(bench.link, "pendingComments", value: [["kind": "pending"]])
    bench.close(bench.link, .lost)
    let copy = bench.ask("snapshot", snapshotInput)
    check(sameJSON(copy.answer?.value, snapshotValue), "while the computer is away a kept read is answered from its copy")
    check((copy.answer?.cachedAt ?? "").count >= 20, "a copy carries the time it was saved")
    let other = bench.ask("snapshot", ["projectId": "local-1", "branch": "other", "commit": NSNull()])
    check(other.failure?.code == "offline", "a read that was never answered is offline, not invented")
    let drafts = bench.ask("pendingComments")
    check(drafts.failure?.code == "offline", "drafts are never answered from a copy")
    let change = bench.ask("startRun", snapshotInput)
    check(change.failure?.code == "offline", "a change is never answered from a copy")
    check(bench.link.closed && entries(bench.root) == 1, "only the kept read is on disk")
    let values = try? bench.root.resourceValues(forKeys: [.isExcludedFromBackupKey])
    check(values?.isExcludedFromBackup == true, "the cache is excluded from backup")
}

func mediaChecks() {
    let bench = Bench()
    bench.online()
    let good = media([137, 80, 78, 71, 1, 2, 3])
    let asked: [String: Any] = ["projectId": "local-1", "sha256": good["sha256"] ?? ""]
    _ = bench.ask("image", asked)
    bench.answer(bench.link, "image", value: good)
    let damaged: [String: Any] = ["projectId": "local-1", "version": "damaged"]
    _ = bench.ask("image", damaged)
    bench.answer(bench.link, "image", value: media([1, 2, 3], hash: String(repeating: "f", count: 64)))
    let renamed: [String: Any] = ["projectId": "local-1", "sha256": String(repeating: "e", count: 64)]
    _ = bench.ask("image", renamed)
    bench.answer(bench.link, "image", value: good)
    bench.close(bench.link, .lost)
    check(sameJSON(bench.ask("image", asked).answer?.value, good), "media whose bytes match its hash is kept")
    check(bench.ask("image", damaged).failure?.code == "offline", "media whose bytes do not match its hash is not kept")
    check(bench.ask("image", renamed).failure?.code == "offline", "media that is not the hash that was asked for is not kept")
}

func authorityChecks() {
    let granted = read()
    granted.event(granted.link, "connection", 1, ["kind": "grant", "grant": ["projects": [["id": "local-1", "name": "One"]], "agents": false]])
    let methods = granted.status["methods"] as? [String] ?? []
    check(!methods.contains("startRun") && methods.contains("snapshot"), "a grant without agents takes the agent methods away at once")
    check(entries(granted.root) == 0, "a changed grant purges what was kept under the old one")
    granted.close(granted.link, .lost)
    check(granted.ask("snapshot", snapshotInput).failure?.code == "offline", "nothing of the old grant is answered afterwards")

    let approved = read()
    approved.close(approved.link, .lost)
    approved.reconnect()
    approved.ready(approved.link, generation: 2)
    check(entries(approved.root) == 0 && approved.vault.record?.generation == 2, "a new generation of the approval purges what was kept under the old one")

    let stale = temporary("stale")
    let earlier = RemoteCache(root: stale)
    earlier.enter("another-computer")
    earlier.save(scope: "another-computer", method: "snapshot", input: snapshotInput, value: snapshotValue)
    check(entries(stale) == 1, "the fixture holds a copy of another authority")
    let fresh = Bench(record: nil, root: stale)
    fresh.start()
    check(entries(stale) == 0 && fresh.state == "unpaired", "a phone without a pairing keeps no copy of anyone")
    let moved = RemoteCache(root: stale)
    moved.enter("another-computer")
    moved.save(scope: "another-computer", method: "snapshot", input: snapshotInput, value: snapshotValue)
    let other = Bench(root: stale)
    other.start()
    check(entries(stale) == 0, "a pairing with another authority removes the copies of the earlier one")
    moved.save(scope: "another-computer", method: "snapshot", input: snapshotInput, value: snapshotValue)
    check(entries(stale) == 0, "a late answer for a purged authority is not written back")
}

private func refuse(_ bench: Bench, _ code: String) -> Reply {
    let reply = bench.ask("snapshot", snapshotInput)
    let id = bench.link.asked("snapshot").last?["id"] ?? ""
    bench.deliver(bench.link, ["type": "response", "id": id, "ok": false, "error": ["code": code, "message": "No."]])
    return reply
}

func denialChecks() {
    let late = Bench()
    late.online()
    let waiting = late.ask("entity", ["projectId": "local-1", "entityId": "page:a"])
    let change = late.ask("startRun", ["projectId": "local-1"])
    late.event(late.link, "connection", 1, ["kind": "grant", "grant": ["projects": [], "agents": false]])
    check(waiting.failure?.message == RemoteFailure.superseded.message, "a read asked under the old grant ends when the grant changes")
    check(change.failure?.message == RemoteFailure.uncertain.message, "a change asked under the old grant ends as uncertain")
    late.answer(late.link, "entity", value: ["id": "page:a"])
    check(waiting.answer == nil && entries(late.root) == 0, "its late answer reaches neither the page nor the cache")

    for code in RemoteFailure.denials.sorted() {
        let bench = read()
        let reply = refuse(bench, code)
        check(reply.failure?.code == code && entries(bench.root) == 0, "\(code) from the computer purges the saved copies")
        bench.close(bench.link, .lost)
        check(bench.state == "offline" && bench.ask("snapshot", snapshotInput).answer == nil, "after \(code) nothing is answered from a copy")
    }
    let ended = read()
    let last = refuse(ended, "revoked")
    check(last.failure?.code == "revoked" && ended.state == "revoked" && ended.vault.record == nil, "a request answered as revoked ends the pairing")
    let plain = read()
    let failed = refuse(plain, "failed")
    check(failed.failure?.code == "failed" && entries(plain.root) == 1 && plain.state == "online", "an ordinary failure purges nothing and ends nothing")
}
