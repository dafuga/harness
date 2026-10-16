import Foundation

// What a recorded artifact has to be before a phone keeps it or serves it from a copy: checked on
// the real `RemoteMedia` and `RemoteCache`, through a real session and on the kept files.

private typealias Refused = (name: String, asked: [String: Any], value: [String: Any])
private let wrongHash = String(repeating: "f", count: 64)
private let otherBytes = Data([9, 9, 9, 9, 9, 9, 9]).base64EncodedString()
private let markup = ["text/html", "text/html; charset=utf-8", "application/xhtml+xml", "image/svg+xml"]
private let scripts = ["text/javascript", "application/javascript", "application/octet-stream", ""]
/// Kinds a computer never serves an artifact as: it names recorded sound by one type of each format.
private let unlisted = ["audio/x-wav", "audio/wave", "audio/x-m4a", "audio/flac", "image/gif"]

/// Answers of a computer that a phone must not keep, each with the question it would answer.
private func refusedAnswers() -> [Refused] {
    let good = Recorded.artifact()
    func changed(_ key: String, _ value: Any) -> [String: Any] {
        good.merging([key: value]) { _, other in other }
    }
    var all: [(String, [String: Any])] = [
        ("other bytes under its stated hash", changed("data", otherBytes)),
        ("a hash its bytes do not have", changed("sha256", wrongHash)),
        ("a length its bytes do not have", changed("byteLength", Recorded.picture.count + 1)),
        ("base64 that does not decode", changed("data", "%%%%")),
        ("another encoding", changed("encoding", "hex")),
        ("no media type", good.filter { $0.key != "mediaType" })
    ]
    let page = Data("<script>alert(1)</script>".utf8)
    for kind in markup + scripts { all.append(("the kind '\(kind)'", Recorded.artifact(page, type: kind))) }
    var cases: [Refused] = all.enumerated().map { item in
        (name: item.element.0, asked: Recorded.capture(item.element.1, state: "case-\(item.offset)"), value: item.element.1)
    }
    let renamed = Recorded.capture(["sha256": String(repeating: "e", count: 64)], state: "renamed")
    cases.append((name: "another hash than the one that was asked", asked: renamed, value: good))
    let unnamed = Recorded.capture(good, state: "unnamed").filter { $0.key != "sha256" }
    cases.append((name: "no hash in its question", asked: unnamed, value: good))
    return cases
}

func artifactIntegrityChecks() {
    let bench = Recorded.bench()
    let good = Recorded.artifact()
    let cases = refusedAnswers()
    for item in cases + [(name: "intact", asked: Recorded.capture(good), value: good)] {
        _ = bench.ask("artifact", item.asked)
        bench.answer(bench.link, "artifact", value: item.value)
    }
    check(entries(bench.root) == 1, "of \(cases.count + 1) answers only the intact artifact of a safe kind is kept")
    bench.close(bench.link, .lost)
    check(sameJSON(bench.ask("artifact", Recorded.capture(good)).answer?.value, good), "the intact one is answered while the computer is away")
    for item in cases {
        check(bench.offline("artifact", item.asked), "an artifact with \(item.name) is not kept")
    }
}

func artifactKindChecks() {
    let kinds = [
        "image/png", "image/jpeg", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "application/json",
        "text/plain; charset=utf-8"
    ]
    let root = temporary("artifact-kinds")
    let cache = RemoteCache(root: root)
    cache.enter("scope")
    let served = kinds.filter { kind in
        let value = Recorded.artifact(Data("{\"ok\":true}".utf8), type: kind)
        let asked = Recorded.capture(value, state: kind)
        cache.save(scope: "scope", method: "artifact", input: asked, value: value)
        return sameJSON(cache.read(scope: "scope", method: "artifact", input: asked)?.value, value)
    }
    check(served == kinds, "pictures, recorded sound, data and plain text are kept and served: \(kinds.count) kinds")
    let outside = markup + scripts + unlisted
    let refused = outside.filter { kind in
        let value = Recorded.artifact(Data("<p>recorded</p>".utf8), type: kind)
        let asked = Recorded.capture(value, state: "refused")
        cache.save(scope: "scope", method: "artifact", input: asked, value: value)
        return cache.read(scope: "scope", method: "artifact", input: asked) == nil && !RemoteMedia.verified("artifact", asked, value)
    }
    check(refused == outside, "markup, scripts and every kind outside the fixed list are refused, though their bytes are intact")
    check(entries(root) == kinds.count, "and none of them is on disk beside the \(kinds.count) safe kinds")
}

/// Rewrites the answer inside the one copy a folder holds, as anything with access to the files could.
private func rewrite(_ root: URL, _ change: (inout [String: Any]) -> Void) {
    let all = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)?.allObjects ?? []
    guard let file = all.compactMap({ $0 as? URL }).first(where: { $0.pathExtension == "json" }),
        var entry = (try? Data(contentsOf: file)).flatMap(RemoteCoding.object), var value = entry["value"] as? [String: Any]
    else { return }
    change(&value)
    entry["value"] = value
    try? RemoteCoding.json(entry)?.write(to: file)
}

func artifactFileChecks() {
    let root = temporary("artifact-files")
    let cache = RemoteCache(root: root)
    cache.enter("scope")
    let good = Recorded.artifact()
    let asked = Recorded.capture(good)
    cache.save(scope: "scope", method: "artifact", input: asked, value: good)
    let served = { cache.read(scope: "scope", method: "artifact", input: asked) != nil }
    check(served() && entries(root) == 1, "an intact artifact is served from its copy")
    check(cache.read(scope: "other", method: "artifact", input: asked) == nil, "a copy is never served under another scope")
    let changes: [(String, String, Any)] = [
        ("its kind changed to markup", "mediaType", "text/html"), ("its bytes changed", "data", otherBytes),
        ("its hash changed", "sha256", wrongHash), ("its length changed", "byteLength", Recorded.picture.count + 1)
    ]
    for (name, key, value) in changes {
        rewrite(root) { $0[key] = value }
        let refused = !served()
        rewrite(root) { $0 = good }
        check(refused && served(), "a copy with \(name) on disk is not served, and is served again once it is intact")
    }
    let held = entries(root)
    let moved = RemoteCache(root: root)
    moved.enter("another-scope")
    let answered = moved.read(scope: "another-scope", method: "artifact", input: asked) != nil
    check(held == 1 && entries(root) == 0 && !answered, "entering another scope removes the artifact and answers nothing")
}

func artifactSizeChecks() {
    let limit = 11 * 1024 * 1024
    let most = Recorded.artifact(Data(count: limit))
    let more = Recorded.artifact(Data(count: limit + 1))
    let small = Recorded.artifact()
    check(RemoteMedia.verified("artifact", Recorded.capture(most), most), "an artifact of exactly 11 MiB is accepted")
    check(!RemoteMedia.verified("artifact", Recorded.capture(more), more), "one byte above 11 MiB is refused, though its bytes are intact")
    let root = temporary("artifact-size")
    let cache = RemoteCache(root: root)
    cache.enter("scope")
    cache.save(scope: "scope", method: "artifact", input: Recorded.capture(small), value: small)
    cache.save(scope: "scope", method: "artifact", input: Recorded.capture(more), value: more)
    let unserved = cache.read(scope: "scope", method: "artifact", input: Recorded.capture(more)) == nil
    check(entries(root) == 1 && unserved, "an artifact above 11 MiB is neither kept nor served")
    try? FileManager.default.removeItem(at: root)
}
