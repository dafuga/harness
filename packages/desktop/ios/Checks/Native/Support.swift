import Foundation

// Support of the native checks: counters, waiting, and stand-ins for the two things a session
// is handed: where a pairing is kept and the link to a computer. Everything else in a check is
// the real code of the app. No check writes to a real keychain or reaches a real relay.

var failures = 0
var passes = 0

func check(_ condition: @autoclosure () -> Bool, _ name: String) {
    if condition() {
        passes += 1
        print("ok   \(name)")
    } else {
        failures += 1
        print("FAIL \(name)")
    }
}

/// Waits until the condition holds, for a few seconds at most.
@discardableResult
func wait(_ seconds: Double = 4, until condition: () -> Bool) -> Bool {
    let end = Date().addingTimeInterval(seconds)
    while !condition() {
        if Date() > end { return false }
        Thread.sleep(forTimeInterval: 0.01)
    }
    return true
}

func temporary(_ name: String) -> URL {
    let base = FileManager.default.temporaryDirectory.appendingPathComponent("harness-native-checks", isDirectory: true)
    return base.appendingPathComponent("\(name)-\(UUID().uuidString)", isDirectory: true)
}

func entries(_ folder: URL) -> Int {
    let all = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: nil)?.allObjects ?? []
    return all.compactMap { $0 as? URL }.filter { $0.pathExtension == "json" }.count
}

/// Where a check keeps a pairing: memory only.
final class MemoryVault: RemoteVault {
    var record: RemoteRecord?
    var wipes = 0

    init(_ record: RemoteRecord?) {
        self.record = record
    }

    func load() -> RemoteRecord? { record }
    func save(_ record: RemoteRecord) throws { self.record = record }
    func wipe() {
        record = nil
        wipes += 1
    }
}

/// A link that reaches nothing: it records what a session sends and lets a check answer.
final class FakeLink: RemoteLink {
    weak var delegate: RemoteLinkDelegate?
    var closed = false
    var sent: [[String: Any]] = []

    func open() {}
    func close() { closed = true }
    func send(_ message: Data) -> Bool {
        guard !closed, let object = RemoteCoding.object(message) else { return false }
        sent.append(object)
        return true
    }

    func asked(_ method: String) -> [[String: Any]] {
        sent.filter { $0["method"] as? String == method }
    }
    var methods: [String] {
        sent.compactMap { $0["method"] as? String }
    }
}

/// What a session answered a request with, once it did.
final class Reply {
    var result: Result<RemoteAnswer, RemoteFailure>?

    var failure: RemoteFailure? {
        if case .failure(let failure)? = result { return failure }
        return nil
    }
    var answer: RemoteAnswer? {
        if case .success(let answer)? = result { return answer }
        return nil
    }
}

/// Collects how a real channel ended.
final class LinkWatcher: RemoteLinkDelegate {
    var closures: [RemoteLinkClosure] = []
    var ready = 0

    func linkReady(_ link: RemoteLink, generation: Int) { ready += 1 }
    func link(_ link: RemoteLink, received message: Data) {}
    func link(_ link: RemoteLink, closed closure: RemoteLinkClosure) { closures.append(closure) }
}

func sameJSON(_ left: Any?, _ right: Any?) -> Bool {
    guard let left = left, let right = right else { return false }
    return RemoteCoding.json(["value": left]) == RemoteCoding.json(["value": right])
}
