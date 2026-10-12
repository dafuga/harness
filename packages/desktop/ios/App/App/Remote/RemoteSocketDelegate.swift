import Foundation

/// What the socket of a link reports: how it ended, and that a redirect is never followed. Only
/// the task knows why a socket ended, so only this decides between a loss and a revocation: an
/// upgrade answered 401 and a close with 4401 both mean the credential is no longer accepted.
final class RemoteSocketDelegate: NSObject, URLSessionWebSocketDelegate {
    var ended: ((RemoteLinkClosure) -> Void)?

    func urlSession(
        _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?
    ) {
        ended?(closeCode.rawValue == 4401 ? .revoked : .lost)
    }

    /// The upgrade is answered by the relay itself. A redirect is never followed, so the
    /// Authorization header cannot be carried to another address.
    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let status = (task.response as? HTTPURLResponse)?.statusCode
        let code = (task as? URLSessionWebSocketTask)?.closeCode.rawValue
        ended?(status == 401 || code == 4401 ? .revoked : .lost)
    }
}
