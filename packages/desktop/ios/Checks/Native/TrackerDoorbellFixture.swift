import Foundation

/// A socket that reaches nothing: a check reports what the account object would.
final class FakeDoorbellSocket: TrackerDoorbellSocket {
    var report: ((TrackerDoorbellEvent) -> Void)?
    var sent: [String] = []
    var closed = false

    func start(_ report: @escaping (TrackerDoorbellEvent) -> Void) { self.report = report }
    func send(_ text: String) { sent.append(text) }
    func close() { closed = true }
}

/// A doorbell over fake sockets, with short waits and everything it said.
final class DoorbellBench {
    let queue: DispatchQueue
    var sockets: [FakeDoorbellSocket] = []
    var asked = 0
    var rings = 0
    var signedIn = true
    private(set) var bell: TrackerDoorbell!

    init(queue: DispatchQueue = DispatchQueue(label: "check.doorbell"),
         timing: TrackerDoorbellTiming = TrackerDoorbellTiming(ping: 30, retry: 0.02, maxRetry: 0.05)
    ) {
        self.queue = queue
        bell = TrackerDoorbell(queue: queue, timing: timing) { [weak self] done in
            guard let self = self else { return done(nil) }
            self.asked += 1
            guard self.signedIn else { return done(nil) }
            let socket = FakeDoorbellSocket()
            self.sockets.append(socket)
            done(socket)
        }
        bell.rang = { [weak self] in self?.rings += 1 }
    }

    func run(_ work: () -> Void) {
        queue.sync(execute: work)
        settle()
    }

    /// Twice: an answer of `open` and a report of a socket each hop onto the queue once more.
    func settle() {
        queue.sync {}
        queue.sync {}
    }

    var live: Bool { queue.sync { bell.live } }
    var socket: FakeDoorbellSocket? { queue.sync { sockets.last } }
    var count: Int { queue.sync { sockets.count } }
    var heard: Int { queue.sync { rings } }

    func say(_ event: TrackerDoorbellEvent, on socket: FakeDoorbellSocket? = nil) {
        (socket ?? self.socket)?.report?(event)
        settle()
    }

    func notice(_ topic: String) {
        say(.message("{\"t\":\"changed\",\"topic\":\"\(topic)\"}"))
    }
}
