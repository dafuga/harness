import Foundation

/// Answered reads of one computer, kept so that they can be shown, dated and read-only, while it
/// is away. It lives in the cache directory of the app: the system may empty it at any time,
/// it is not backed up, and its files are protected until the phone was unlocked once.
///
/// One scope holds what was read under one exact authority: relay, computer, phone, generation
/// of the approval and grant. Entering a scope removes every other one. Every write keeps the
/// scope inside its budget of copies and bytes. Nothing here is a draft or a change; a change
/// is never kept and never answered from here.
final class RemoteCache {
    static let kept: Set<String> = [
        "listProjects", "snapshot", "entity", "messages", "image", "source", "history", "evidence", "artifact"
    ]
    let budget: RemoteCacheBudget
    private let root: URL
    private let files = FileManager.default
    private var index = RemoteCacheIndex()
    private var entered: String?

    init(root: URL? = nil, budget: RemoteCacheBudget = .standard) {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.root = root ?? caches.appendingPathComponent("HarnessRemote", isDirectory: true)
        self.budget = budget
    }

    /// How much is kept right now: copies and bytes of reads, nothing else.
    var usage: (entries: Int, bytes: Int) {
        (index.count, index.bytes)
    }

    static func scope(of record: RemoteRecord) -> String {
        let grant = RemoteCoding.json(record.grant.object).flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let parts = [record.origin, record.hostId, record.deviceId, String(record.generation), grant]
        return RemoteCoding.hex(RemoteCoding.sha256(Data(parts.joined(separator: "\n").utf8)))
    }

    /// Opens the scope of the current authority and removes what was read under any other.
    func enter(_ scope: String) {
        let others = (try? files.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        others.filter { $0.lastPathComponent != scope }.forEach { try? files.removeItem(at: $0) }
        let own = folder(scope)
        let protection = [FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        try? files.createDirectory(at: own, withIntermediateDirectories: true, attributes: protection)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var top = root
        try? top.setResourceValues(values)
        entered = scope
        index = RemoteCacheIndex()
        let keys: Set<URLResourceKey> = [.contentModificationDateKey, .fileSizeKey]
        let found = (try? files.contentsOfDirectory(at: own, includingPropertiesForKeys: Array(keys))) ?? []
        let dated = found.map { ($0.lastPathComponent, try? $0.resourceValues(forKeys: keys)) }
        let oldestFirst = dated.sorted {
            ($0.1?.contentModificationDate ?? .distantPast) < ($1.1?.contentModificationDate ?? .distantPast)
        }
        oldestFirst.forEach { index.note($0.0, bytes: $0.1?.fileSize ?? 0) }
        evict()
    }

    /// The authority ended: nothing that was read under it stays.
    func purge() {
        try? files.removeItem(at: root)
        index = RemoteCacheIndex()
        entered = nil
    }

    /// Keeps one answered read of the entered scope and evicts what the budget no longer holds.
    /// An answer for another scope, or for one that was purged meanwhile, is dropped; so is
    /// media whose bytes are not what it says, and a copy larger than the whole budget.
    func save(scope: String, method: String, input: [String: Any], value: Any) {
        guard scope == entered, Self.kept.contains(method), RemoteMedia.verified(method, input, value),
            let file = file(scope, method, input), files.fileExists(atPath: folder(scope).path)
        else { return }
        let entry: [String: Any] = ["savedAt": RemoteCoding.now(), "method": method, "input": input, "value": value]
        guard let data = RemoteCoding.json(entry), data.count <= budget.bytes,
            (try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])) != nil
        else { return }
        index.note(file.lastPathComponent, bytes: data.count)
        evict()
    }

    /// The copy of exactly this read, with the time it was saved, or nil. A copy that is read
    /// counts as used, so that what a person looks at is the last to be evicted.
    func read(scope: String, method: String, input: [String: Any]) -> RemoteAnswer? {
        guard scope == entered, Self.kept.contains(method), let file = file(scope, method, input),
            let entry = (try? Data(contentsOf: file)).flatMap(RemoteCoding.object),
            entry["method"] as? String == method, let saved = entry["savedAt"] as? String,
            let value = entry["value"], let asked = RemoteCoding.json(input),
            (entry["input"] as? [String: Any]).flatMap(RemoteCoding.json) == asked,
            RemoteMedia.verified(method, input, value)
        else { return nil }
        index.touch(file.lastPathComponent)
        try? files.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
        return RemoteAnswer(value: value, cachedAt: saved)
    }

    private func folder(_ scope: String) -> URL {
        root.appendingPathComponent(scope, isDirectory: true)
    }

    private func file(_ scope: String, _ method: String, _ input: [String: Any]) -> URL? {
        guard let key = RemoteCoding.json(input) else { return nil }
        let name = RemoteCoding.hex(RemoteCoding.sha256(Data(method.utf8) + Data([10]) + key))
        return folder(scope).appendingPathComponent("\(name).json")
    }

    private func evict() {
        guard let scope = entered else { return }
        index.overflow(budget).forEach { try? files.removeItem(at: folder(scope).appendingPathComponent($0)) }
    }
}
