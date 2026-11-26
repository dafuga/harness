import Foundation

/// How long the doorbell waits: between two pings, and before it reopens a lost socket.
struct TrackerDoorbellTiming {
    var ping = 15.0
    var retry = 0.5
    var maxRetry = 10.0
}

/// Follows the change notices of the account object (`GET /api/sync/v1/live`). A notice names a
/// topic and carries no content, so it only says: read again. Notices are not replayed, so every
/// connect rings once to cover what was missed. Every call and callback runs on `queue`.
final class TrackerDoorbell {
    typealias Open = (@escaping (TrackerDoorbellSocket?) -> Void) -> Void

    var rang: () -> Void = {}
    var moved: () -> Void = {}
    private(set) var live = false

    private let queue: DispatchQueue
    private let timing: TrackerDoorbellTiming
    private let open: Open
    private var wanted = false
    private var socket: TrackerDoorbellSocket?
    private var timer: DispatchWorkItem?
    private var attempt = 0
    private var failures = 0
    private var heard = true

    init(queue: DispatchQueue, timing: TrackerDoorbellTiming = TrackerDoorbellTiming(), open: @escaping Open) {
        self.queue = queue
        self.timing = timing
        self.open = open
    }

    func start() {
        guard !wanted else { return }
        wanted = true
        failures = 0
        connect()
    }

    func stop() {
        guard wanted else { return }
        wanted = false
        release()
        setLive(false)
    }

    /// Skips the wait, for a network that just returned.
    func retryNow() {
        guard wanted, !live, failures > 0 else { return }
        failures = 0
        connect()
    }

    private func connect() {
        release()
        let mine = attempt
        open { [weak self] next in
            self?.queue.async { self?.opening(next, attempt: mine) }
        }
    }

    private func opening(_ next: TrackerDoorbellSocket?, attempt mine: Int) {
        guard wanted, mine == attempt else {
            next?.close()
            return
        }
        guard let next = next else { return drop() }
        socket = next
        heard = true
        next.start { [weak self] event in
            self?.queue.async { self?.receive(event, attempt: mine) }
        }
        beat()
    }

    private func receive(_ event: TrackerDoorbellEvent, attempt mine: Int) {
        guard wanted, mine == attempt else { return }
        heard = true
        switch event {
        case .opened:
            failures = 0
            setLive(true)
            rang()
        case .message(let text):
            if Self.rings(text) { rang() }
        case .closed:
            drop()
        }
    }

    /// Closes the current socket and its timer; its late events are ignored.
    private func release() {
        attempt += 1
        timer?.cancel()
        timer = nil
        socket?.close()
        socket = nil
    }

    /// Also the path of a half-open socket, whose close may never arrive.
    private func drop() {
        release()
        setLive(false)
        let wait = min(timing.maxRetry, timing.retry * pow(2, Double(min(failures, 16))))
        failures += 1
        after(wait) { $0.connect() }
    }

    private func setLive(_ next: Bool) {
        guard live != next else { return }
        live = next
        moved()
    }
}

extension TrackerDoorbell {
    /// One beat without an open socket, or without a word since the last ping, ends the socket.
    private func beat() {
        after(timing.ping) { bell in
            guard bell.live, bell.heard else { return bell.drop() }
            bell.heard = false
            bell.socket?.send("ping")
            bell.beat()
        }
    }

    private func after(_ seconds: Double, _ work: @escaping (TrackerDoorbell) -> Void) {
        timer?.cancel()
        let next = DispatchWorkItem { [weak self] in
            if let self = self { work(self) }
        }
        timer = next
        queue.asyncAfter(deadline: .now() + seconds, execute: next)
    }

    /// A change of the tracker copy the Hub holds, or a sealed poke. Chat notices, sign-in
    /// notices and the answer to a ping say nothing about the tracker.
    static func rings(_ text: String) -> Bool {
        guard text.utf8.count <= 4096, let notice = RemoteCoding.object(Data(text.utf8)) else { return false }
        if notice["t"] as? String == "poke" { return true }
        return notice["t"] as? String == "changed" && notice["topic"] as? String == "home"
    }
}
