import Foundation

/// The link to the relay (backend-contract.md section 5.2) with the end-to-end channel inside
/// it. The credential travels only in the Authorization header of the upgrade; the relay sees
/// sealed packets and nothing of what they carry.
final class RemoteChannel: RemoteLink {
    weak var delegate: RemoteLinkDelegate?
    private let record: RemoteRecord
    private let queue: DispatchQueue
    private let socket = RemoteSocketDelegate()
    private let pulse = RemotePulse()
    private var session: URLSession?
    private var task: URLSessionWebSocketTask?
    private var secure = RemoteSecureState()
    private var closed = false

    init(record: RemoteRecord, queue: DispatchQueue) {
        self.record = record
        self.queue = queue
    }

    func open() {
        guard let origin = RemotePolicy.origin(record.origin),
            let url = RemotePolicy.socket(origin, hostId: record.hostId)
        else { return finish(.lost) }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(record.credential)", forHTTPHeaderField: "Authorization")
        request.setValue("device", forHTTPHeaderField: "X-Harness-Role")
        request.setValue(record.deviceId, forHTTPHeaderField: "X-Harness-Device")
        let operations = OperationQueue()
        operations.underlyingQueue = queue
        socket.ended = { [weak self] closure in self?.finish(closure) }
        let session = URLSession(configuration: .ephemeral, delegate: socket, delegateQueue: operations)
        let task = session.webSocketTask(with: request)
        task.maximumMessageSize = RemoteLimits.frameBytes
        self.session = session
        self.task = task
        task.resume()
        listen()
        write(secure.hello(deviceId: record.deviceId))
        pulse.start(
            on: queue, ping: { [weak self] in self?.task?.send(.string("ping")) { _ in } },
            lost: { [weak self] in self?.finish(.lost) })
    }

    func close() {
        closed = true
        pulse.stop()
        task?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()
    }

    func send(_ message: Data) -> Bool {
        guard !closed, let packets = secure.seal(message) else { return false }
        packets.forEach(write)
        return true
    }

    private func write(_ packet: [String: Any]) {
        guard let data = RemoteCoding.json(packet), let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { _ in }
    }

    /// A frame that is not text is not part of the protocol and ends the link. A read that
    /// failed says only that the socket ended; why, its task reports to the socket delegate.
    private func listen() {
        task?.receive { [weak self] result in
            self?.queue.async {
                guard let self = self, !self.closed else { return }
                switch result {
                case .success(.string(let text)):
                    self.accept(text)
                    self.listen()
                case .success: self.finish(.lost)
                case .failure: break
                }
            }
        }
    }

    private func accept(_ text: String) {
        if text == "pong" { return pulse.answered() }
        guard let packet = RemoteCoding.object(Data(text.utf8)), let type = packet["type"] as? String else {
            return finish(.lost)
        }
        switch type {
        case "accept": accepted(packet)
        case "sealed": opened(packet)
        case "reject":
            let reason = packet["reason"] as? String
            finish(reason == "revoked" || reason == "unknown-device" ? .revoked : .lost)
        case "relay": relayed(packet)
        default: finish(.lost)
        }
    }

    private func accepted(_ packet: [String: Any]) {
        guard let generation = secure.accept(packet, record: record) else { return finish(.lost) }
        delegate?.linkReady(self, generation: generation)
    }

    private func opened(_ packet: [String: Any]) {
        switch secure.open(packet) {
        case .message(let message): delegate?.link(self, received: message)
        case .partial: break
        case .invalid: finish(.lost)
        }
    }

    /// The relay says whether the computer is there. When it comes back, a new handshake starts.
    private func relayed(_ packet: [String: Any]) {
        if packet["event"] as? String == "host-online" {
            write(secure.hello(deviceId: record.deviceId))
        } else {
            secure.drop()
            delegate?.link(self, closed: .hostOffline)
        }
    }

    private func finish(_ closure: RemoteLinkClosure) {
        guard !closed else { return }
        close()
        delegate?.link(self, closed: closure)
    }
}
