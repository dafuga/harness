import Foundation

/// How much a phone keeps of what it read. It is a budget of rebuildable copies only: no part
/// of a pairing, no credential and no change is counted here, and none is ever evicted by it.
struct RemoteCacheBudget {
    var entries: Int
    var bytes: Int

    static let standard = RemoteCacheBudget(entries: 1500, bytes: 256 * 1024 * 1024)
}

/// Which copies a scope holds, how large they are and in which order they were last used.
/// When the budget is exceeded, the least recently used leave first.
struct RemoteCacheIndex {
    private struct Copy {
        var bytes: Int
        var used: UInt64
    }

    private var copies: [String: Copy] = [:]
    private var clock: UInt64 = 0
    private(set) var bytes = 0

    var count: Int { copies.count }

    /// A copy was written, or found on disk: it is the most recently used one now.
    mutating func note(_ name: String, bytes size: Int) {
        clock += 1
        bytes += size - (copies[name]?.bytes ?? 0)
        copies[name] = Copy(bytes: size, used: clock)
    }

    mutating func touch(_ name: String) {
        guard copies[name] != nil else { return }
        clock += 1
        copies[name]?.used = clock
    }

    mutating func forget(_ name: String) {
        bytes -= copies.removeValue(forKey: name)?.bytes ?? 0
    }

    /// The copies that have to leave so that the budget holds, least recently used first.
    mutating func overflow(_ budget: RemoteCacheBudget) -> [String] {
        var gone: [String] = []
        let order = copies.sorted { $0.value.used < $1.value.used }.map { $0.key }
        for name in order where copies.count > budget.entries || bytes > budget.bytes {
            forget(name)
            gone.append(name)
        }
        return gone
    }
}
