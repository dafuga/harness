import Foundation

enum TrackerDoorbellEvent: Equatable {
    case opened
    case message(String)
    case closed
}

/// The socket under the doorbell. The app's is URLSession; a check hands in its own.
protocol TrackerDoorbellSocket: AnyObject {
    func start(_ report: @escaping (TrackerDoorbellEvent) -> Void)
    func send(_ text: String)
    func close()
}

/// One WebSocket to the account object: no cookie, cache or stored credential, and no redirect is
/// followed, so the session header goes nowhere else. Sealed binary frames are not read here: the
/// doorbell subscribes to no scope and holds no key.
final class TrackerDoorbellChannel: NSObject, TrackerDoorbellSocket, URLSessionWebSocketDelegate {
    private let request: URLRequest
    private var session: URLSession?
    private var task: URLSessionWebSocketTask?
    private var report: ((TrackerDoorbellEvent) -> Void)?

    init(_ request: URLRequest) {
        self.request = request
    }

    func start(_ report: @escaping (TrackerDoorbellEvent) -> Void) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.urlCredentialStorage = nil
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        let task = session.webSocketTask(with: request)
        task.maximumMessageSize = 256 * 1024 + 8
        self.report = report
        self.session = session
        self.task = task
        task.resume()
        receive(task, report)
    }

    func send(_ text: String) {
        task?.send(.string(text)) { _ in }
    }

    /// Invalidating the session also lets go of this delegate.
    func close() {
        task?.cancel(with: .normalClosure, reason: nil)
        session?.invalidateAndCancel()
        task = nil
        session = nil
    }

    private func receive(_ task: URLSessionWebSocketTask, _ report: @escaping (TrackerDoorbellEvent) -> Void) {
        task.receive { [weak self, weak task] result in
            guard case .success(let message) = result else { return report(.closed) }
            if case .string(let text) = message { report(.message(text)) }
            if let self = self, let task = task { self.receive(task, report) }
        }
    }

    func urlSession(
        _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        report?(.opened)
    }

    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        report?(.closed)
    }
}
