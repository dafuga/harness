import Foundation

@MainActor
protocol TrackerSealedLiveTransport {
    var connected: Bool { get }
    func stop()
    func start(_ hub: TrackerSealedHub, scopes: [String], after: Int64,
        receive: @escaping (URLSessionWebSocketTask.Message) -> Void) throws
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class TrackerSealedLive: TrackerSealedLiveTransport {
    private var task: Task<Void, Never>?
    private var connection: URLSession?

    var connected: Bool { task != nil }

    func stop() {
        task?.cancel()
        task = nil
        connection?.invalidateAndCancel()
        connection = nil
    }

    func start(_ hub: TrackerSealedHub, scopes: [String], after: Int64,
        receive: @escaping (URLSessionWebSocketTask.Message) -> Void
    ) throws {
        stop()
        let (session, socket) = try hub.openSocket(RemoteSocketDelegate())
        connection = session
        socket.resume()
        task = Task {
            defer { if !Task.isCancelled { stop() } }
            do {
                let input = try subscription(scopes, after: after)
                try await socket.send(.string(input))
                while !Task.isCancelled {
                    let message = try await socket.receive()
                    try Task.checkCancellation()
                    receive(message)
                }
            } catch {
                // The foreground pulse reopens the socket at the last authenticated ring position.
            }
        }
    }

    private func subscription(_ scopes: [String], after: Int64) throws -> String {
        guard scopes.count <= 64, let data = RemoteCoding.json([
            "t": "subscribe", "scopes": scopes, "after": after
        ]), let text = String(data: data, encoding: .utf8) else { throw TrackerReplicaError.invalidPage }
        return text
    }
}
