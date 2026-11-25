import Darwin
import Foundation

struct TrackerSealedFixture {
    let run = "session-cache-canary-fixture"
    let scope = try! SealedScopeKeys(.make())
    let stream = RemoteCoding.random(16)
    var keys: TrackerReplicaSessionKeys { TrackerReplicaSessionKeys(current: scope, epochs: [scope.epoch: scope]) }

    func record(_ kind: String, revision: UInt64 = 1, status: String = "running", captured: Bool = false) throws -> String {
        var id = kind == "session" ? run : TrackerReplicaSealedRecord.segmentId(run, 0)
        var body: [String: Any] = ["kind": kind, "runId": run]
        if kind == "session" {
            body["streamId"] = RemoteCoding.base64url(stream)
            body["status"] = status
            body["details"] = ["elapsed": 0.25]
        } else {
            body["index"] = 0
            body["data"] = RemoteCoding.base64url(Data(sessionTimingText.utf8))
            if captured {
                let name = RemoteCoding.base64url(stream)
                body["streamId"] = name
                body["throughCounter"] = "18446744073709551615"
                id = SealedJson.array([.string(run), .string(name), .string("18446744073709551615")]).canonical
            }
        }
        let object = try scope.objectId(kind: kind, localId: id)
        let record = try SealedRecord.seal(RemoteCoding.json(body)!, keys: scope,
            object: SealedObjectRef(objectId: object, revision: revision))
        return RemoteCoding.base64url(record)
    }

    func frame(ring: UInt64, counter: UInt64, text: String = "live-output-canary-fixture") throws -> Data {
        let sealedStream = try SealedStream(keys: scope, id: stream)
        let frame = try SealedFrame.seal(SealedPadding.pad(Data(text.utf8)),
            keys: scope, stream: sealedStream, counter: counter)
        return SealedBytes.u64(ring) + frame
    }
}

func trackerSealedCacheChecks() {
    let root = temporary("sealed-accounts")
    defer { try? FileManager.default.removeItem(at: root) }
    do {
        let fixture = TrackerSealedFixture()
        let cache = try storedSession(fixture, root: root)
        try checkSealedLive(fixture, cache: cache)
        let oldScope = "a-fixture-account"
        let restarted = TrackerReplicaSealed(root: root)
        restarted.enter(oldScope)
        let text = try restarted.transcript(fixture.run, index: 0, keys: fixture.keys)
        check(text == Data(sessionTimingText.utf8), "a fresh native replica decrypts saved first text without a Mac or Hub")
        let cursor = try restarted.cursor(fixture.scope.name)
        check(cursor == 3, "revisions and durable cursor survive a restart")
        try checkCapturedTranscript(fixture, cache: restarted)
        try checkCiphertext(fixture, root: root)
        if ProcessInfo.processInfo.environment["HARNESS_IOS_SESSION_TIMING"] == "1" {
            try measureSealedRead(fixture, cache: restarted)
            try measureRecordOpen(fixture.scope)
        }
        restarted.enter("a-different-fixture-account")
        let switched = try restarted.transcript(fixture.run, index: 0, keys: fixture.keys)
        check(switched == nil, "another account cannot see the old account's cache")
        restarted.purge()
        check(!FileManager.default.fileExists(atPath: root.path), "sign-out removes the account database")
    } catch {
        check(false, "sealed cache fixture completed")
    }
}

private func checkCapturedTranscript(_ fixture: TrackerSealedFixture, cache: TrackerReplicaSealed) throws {
    let record = try TrackerReplicaSealedRecord.open(fixture.record("transcript", captured: true), keys: fixture.scope)
    try cache.advance(4, scope: fixture.scope.name, record: record)
    let page = try cache.transcriptPage(fixture.run, index: 0, keys: fixture.keys)
    check(page?.data == Data(sessionTimingText.utf8)
        && page?.captured == ["stream": RemoteCoding.base64url(fixture.stream), "counter": "18446744073709551615"],
        "the publisher's stream-addressed transcript opens by page and preserves its full frame counter")
}

private func storedSession(_ fixture: TrackerSealedFixture, root: URL) throws -> TrackerReplicaSealed {
    let cache = TrackerReplicaSealed(root: root)
    cache.enter("a-fixture-account")
    let summary = try TrackerReplicaSealedRecord.open(fixture.record("session", revision: 2), keys: fixture.scope)
    let text = try TrackerReplicaSealedRecord.open(fixture.record("transcript"), keys: fixture.scope)
    try cache.advance(1, scope: fixture.scope.name, record: summary)
    try cache.advance(2, scope: fixture.scope.name, record: text)
    let old = try TrackerReplicaSealedRecord.open(fixture.record("session", status: "rolled-back"), keys: fixture.scope)
    try cache.advance(3, scope: fixture.scope.name, record: old)
    let sessions = try cache.sessions([fixture.scope.name: fixture.keys])
    check(sessions.count == 1 && sessions.first?["runId"] as? String == fixture.run
        && sessions.first?["status"] as? String == "running", "a stale revision cannot replace the authenticated cached session")
    let rows = try cache.database().rows("SELECT envelope FROM sealed_objects WHERE id = ?",
        [RemoteCoding.base64url(text!.header.objectId)])
    check(rows.first?.first == text!.wire, "the SQLite object is the exact base64url envelope from the wire")
    return cache
}

private func checkSealedLive(_ fixture: TrackerSealedFixture, cache: TrackerReplicaSealed) throws {
    let first = try TrackerReplicaLiveFrame(fixture.frame(ring: 2, counter: 0))
    try cache.accept(first, keys: fixture.scope)
    let replay = try TrackerReplicaLiveFrame(SealedBytes.u64(4) + first.envelope)
    try cache.accept(replay, keys: fixture.scope)
    let forged = try TrackerReplicaLiveFrame(SealedBytes.u64(9) + first.envelope.dropLast() + Data([first.envelope.last! ^ 1]))
    let accepted: Void? = try? cache.accept(forged, keys: fixture.scope)
    let ring = try cache.ring()
    check(accepted == nil && ring == 4, "a tampered frame does not advance the replay position")
    let stored = try cache.liveBytes(stream: fixture.stream, keys: fixture.scope, after: nil)
    check(stored.count == 1 && String(data: stored[0].1, encoding: .utf8) == "live-output-canary-fixture",
        "an authenticated frame is opened on read and a replay is displayed only once")
    for counter in 1...65 {
        let message = try TrackerReplicaLiveFrame(fixture.frame(ring: UInt64(counter + 4), counter: UInt64(counter)))
        try cache.accept(message, keys: fixture.scope)
    }
    try cache.accept(replay, keys: fixture.scope)
    let bounded = try cache.liveBytes(stream: fixture.stream, keys: fixture.scope, after: nil)
    check(bounded.first?.0 == 2, "live tail remains bounded and a replay cannot return after frame eviction")
}

private func checkCiphertext(_ fixture: TrackerSealedFixture, root: URL) throws {
    let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)?.allObjects ?? []
    let disk = try files.compactMap { $0 as? URL }.filter { $0.pathExtension == "sqlite" }.map { try Data(contentsOf: $0) }
    let readCanary = Data("native-session-timing-fixture".utf8)
    let plaintext = [Data(fixture.run.utf8), readCanary, Data("live-output-canary-fixture".utf8)]
    let spellings = plaintext.flatMap { [
        $0, Data($0.base64EncodedString().utf8), Data(RemoteCoding.base64url($0).utf8),
        Data(RemoteCoding.hex($0).utf8)
    ] }
    check(disk.count == 1 && spellings.allSatisfy { word in disk.allSatisfy { $0.range(of: word) == nil } },
        "the SQLite file contains no plaintext or encoded fixture canaries")
}

private func measureSealedRead(_ fixture: TrackerSealedFixture, cache: TrackerReplicaSealed) throws {
    let bytes = Data(sessionTimingText.utf8)
    var measurements: [Double] = []
    for _ in 0..<120 {
        let start = DispatchTime.now().uptimeNanoseconds
        guard try cache.transcript(fixture.run, index: 0, keys: fixture.keys) == bytes else {
            return check(false, "sealed read timing fixture returned first text")
        }
        measurements.append(Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000)
    }
    printSessionTiming("Fixture sealed SQLite read", measurements)
    let ordered = measurements.sorted()
    check(ordered[59] <= 50 && ordered[113] <= 100, "fixture sealed SQLite text read stays within the p50 and p95 budgets")
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &info) { pointer in
        pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    if result == KERN_SUCCESS { print("Native check process RSS after sealed read: \(info.resident_size) bytes") }
}


private func measureRecordOpen(_ scope: SealedScopeKeys) throws {
    let data = Data(repeating: 65, count: 100 * 1024)
    let id = try scope.objectId(kind: "measurement", localId: "synthetic-100-kib")
    let envelope = try SealedRecord.seal(data, keys: scope, object: SealedObjectRef(objectId: id, revision: 1))
    var durations: [Double] = []
    for _ in 0..<120 {
        let start = DispatchTime.now().uptimeNanoseconds
        guard try SealedRecord.open(envelope, keys: scope).json == data else {
            return check(false, "100 KiB fixture opens to its original bytes")
        }
        durations.append(Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000)
    }
    printSessionTiming("Fixture CryptoKit 100 KiB record open", durations)
}
