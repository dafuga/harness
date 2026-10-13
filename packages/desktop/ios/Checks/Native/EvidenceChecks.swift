import CryptoKit
import Foundation

// Recorded runtime evidence on a phone: the reads `evidence` and `artifact`, checked on the real
// `RemoteSession` and `RemoteCache`. What an artifact has to be is checked in ArtifactChecks.

/// What a check asks and answers for recorded evidence. Every value here is synthetic.
enum Recorded {
    static let attached = Bench.methods + ["evidence", "artifact"]
    static let pinned = String(repeating: "c", count: 40)
    static let later = String(repeating: "e", count: 40)
    static let picture = Data([137, 80, 78, 71, 1, 2, 3])
    static let query: [String: Any] = [
        "projectId": "local-1", "entityId": "page:a", "commit": String(repeating: "a", count: 40), "branch": "main",
        "mode": "current"
    ]

    /// Metadata as a computer answers it, with the notes revision it was read at.
    static func metadata(notes: String = pinned) -> [String: Any] {
        ["identity": ["notesRevision": notes, "evidenceRevision": pinned], "evidence": ["after": ["captures": 1]]]
    }

    /// One artifact on the wire: base64 with the length and the hash of exactly these bytes.
    static func artifact(_ data: Data = picture, type: String = "image/png") -> [String: Any] {
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return [
            "encoding": "base64", "mediaType": type, "byteLength": data.count, "sha256": digest,
            "data": data.base64EncodedString()
        ]
    }

    /// The question for one artifact: its binding, the hash it has to have and the pinned notes.
    static func capture(_ value: [String: Any], notes: String = pinned, state: String = "filled") -> [String: Any] {
        let binding: [String: Any] = [
            "side": "after", "recordId": String(repeating: "b", count: 64), "scenarioId": "titles-page", "state": state,
            "evidenceId": "screens", "viewport": "mobile", "sha256": value["sha256"] ?? "", "notesRevision": notes,
            "evidenceRevision": pinned
        ]
        return query.merging(binding) { _, bound in bound }
    }

    /// A session whose computer attached both reads.
    static func bench(_ record: RemoteRecord? = Bench.record(), root: URL = temporary("evidence")) -> Bench {
        let bench = Bench(record: record, root: root)
        bench.start()
        bench.attach(Bench.Answer(methods: attached), generation: record?.generation ?? 1)
        return bench
    }

    /// A session that read the evidence of one entity and one artifact of it while online.
    static func read(_ record: RemoteRecord? = Bench.record(), root: URL = temporary("evidence")) -> Bench {
        let bench = Recorded.bench(record, root: root)
        _ = bench.ask("evidence", query)
        bench.answer(bench.link, "evidence", value: metadata())
        _ = bench.ask("artifact", capture(artifact()))
        bench.answer(bench.link, "artifact", value: artifact())
        return bench
    }
}

extension Bench {
    /// True when a read ends as offline: no copy answered it, and nothing was invented.
    func offline(_ method: String, _ input: [String: Any]) -> Bool {
        ask(method, input).failure?.code == "offline"
    }
}

func evidenceOfferChecks() {
    let plain = Bench()
    plain.online()
    let refused = [plain.ask("evidence", Recorded.query), plain.ask("artifact", Recorded.capture(Recorded.artifact()))]
    check(refused.allSatisfy { $0.failure?.code == "method-denied" }, "recorded evidence a computer did not attach is refused")
    check(plain.link.asked("evidence").isEmpty && plain.link.asked("artifact").isEmpty, "and is never sent")
    let bench = Recorded.bench()
    let methods = bench.status["methods"] as? [String] ?? []
    check(methods.contains("evidence") && methods.contains("artifact"), "evidence and artifact are offered once the computer attached them")
    _ = bench.ask("evidence", Recorded.query)
    _ = bench.ask("artifact", Recorded.capture(Recorded.artifact()))
    let sent = [bench.link.asked("evidence").last, bench.link.asked("artifact").last].map { $0?["input"] as? [String: Any] }
    check(sameJSON(sent[0], Recorded.query), "evidence is sent with exactly what was asked")
    check(sameJSON(sent[1], Recorded.capture(Recorded.artifact())), "an artifact is sent with its whole binding, and as a read it names no epoch")
    bench.close(bench.link, .lost)
    bench.reconnect()
    bench.attach(Bench.Answer(epoch: "epoch-2"))
    check((bench.status["methods"] as? [String] ?? ["evidence"]).contains("evidence") == false, "an attach that leaves evidence out takes it away")
    check(bench.ask("evidence", Recorded.query).failure?.code == "method-denied", "and it is refused again")
}

func evidenceCopyChecks() {
    let bench = Recorded.bench()
    let first = bench.ask("evidence", Recorded.query)
    bench.answer(bench.link, "evidence", value: Recorded.metadata())
    check(sameJSON(first.answer?.value, Recorded.metadata()) && first.answer?.cachedAt == nil, "evidence the computer answered is not called a copy")
    _ = bench.ask("evidence", Recorded.query)
    bench.answer(bench.link, "evidence", value: Recorded.metadata(notes: Recorded.later))
    check(entries(bench.root) == 1, "after a notes update the newer answer replaces the copy of the same question")
    let link = bench.link
    bench.close(link, .lost)
    let copy = bench.ask("evidence", Recorded.query)
    check(sameJSON(copy.answer?.value, Recorded.metadata(notes: Recorded.later)), "while the computer is away evidence is answered from its latest copy")
    check((copy.answer?.cachedAt ?? "").count >= 20, "kept evidence carries the time it was saved")
    let project = Recorded.query.merging(["projectId": "local-2"]) { _, other in other }
    check(bench.offline("evidence", project), "evidence of another project is never answered from this copy")
    let commit = Recorded.query.merging(["mode": "commit"]) { _, other in other }
    check(bench.offline("evidence", commit), "evidence asked for another comparison is offline, not invented")
    check(link.asked("evidence").count == 2, "nothing is sent while the computer is away")
}

func artifactCopyChecks() {
    let bench = Recorded.bench()
    let good = Recorded.artifact()
    let asked = Recorded.capture(good)
    let live = bench.ask("artifact", asked)
    bench.answer(bench.link, "artifact", value: good)
    check(sameJSON(live.answer?.value, good) && live.answer?.cachedAt == nil, "an artifact the computer answered is handed on as it came")
    bench.close(bench.link, .lost)
    let copy = bench.ask("artifact", asked)
    check(sameJSON(copy.answer?.value, good), "while the computer is away an artifact is answered from its copy")
    check((copy.answer?.cachedAt ?? "").count >= 20, "a kept artifact carries the time it was saved")
    check(bench.offline("artifact", Recorded.capture(good, notes: Recorded.later)), "the artifact of earlier notes is never answered for the question of later ones")
    check(bench.offline("artifact", Recorded.capture(good, state: "empty")), "an artifact is never answered for another state of the same entity")
    let project = asked.merging(["projectId": "local-2"]) { _, other in other }
    check(bench.offline("artifact", project), "an artifact of another project is never answered from this copy")
    check(bench.offline("image", ["projectId": "local-1", "sha256": good["sha256"] ?? ""]), "an artifact is never answered as a design image of the same hash")
}

func evidenceAuthorityChecks() {
    let asked = Recorded.capture(Recorded.artifact())
    let reader: [String: Any] = ["projects": [["id": "local-1", "name": "One"]], "agents": false]
    let granted = Recorded.read()
    let held = entries(granted.root)
    granted.event(granted.link, "connection", 1, ["kind": "grant", "grant": reader])
    check(held == 2 && entries(granted.root) == 0, "a changed grant purges kept evidence and artifacts")
    granted.close(granted.link, .lost)
    check(granted.offline("evidence", Recorded.query) && granted.offline("artifact", asked), "nothing of the old grant is answered afterwards")

    let ended = Recorded.read()
    let before = entries(ended.root)
    ended.close(ended.link, .revoked)
    check(before == 2 && entries(ended.root) == 0 && ended.state == "revoked", "a revocation purges kept evidence and artifacts")
    check(ended.ask("artifact", asked).answer == nil && ended.ask("evidence", Recorded.query).answer == nil, "after a revocation neither is answered")

    let approved = Recorded.read()
    let earlier = entries(approved.root)
    approved.close(approved.link, .lost)
    approved.reconnect()
    approved.ready(approved.link, generation: 2)
    check(earlier == 2 && entries(approved.root) == 0, "a new generation of the approval purges kept evidence and artifacts")

    let late = Recorded.bench()
    let waiting = late.ask("artifact", asked)
    late.event(late.link, "connection", 1, ["kind": "grant", "grant": reader])
    late.answer(late.link, "artifact", value: Recorded.artifact())
    check(waiting.failure?.message == RemoteFailure.superseded.message, "an artifact asked under the old grant ends when the grant changes")
    check(waiting.answer == nil && entries(late.root) == 0, "its late answer reaches neither the page nor the cache")

    let shared = temporary("evidence-scope")
    let first = Recorded.read(root: shared)
    let kept = entries(shared)
    first.close(first.link, .lost)
    let other = Recorded.bench(Bench.record(generation: 2), root: shared)
    check(kept == 2 && entries(shared) == 0, "a pairing with another authority removes the kept evidence of the earlier one")
    other.close(other.link, .lost)
    check(other.offline("evidence", Recorded.query) && other.offline("artifact", asked), "and never answers a copy of another scope")
}
