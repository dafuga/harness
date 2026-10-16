import Foundation

/// The public pairing routes of a relay (backend-contract.md section 5.1). No cookie, no cache,
/// no credential: a credential exists only after the exchange and then travels in a header.
final class RemoteRelayClient: NSObject, URLSessionTaskDelegate {
    typealias Answer = (Result<[String: Any], RemoteFailure>) -> Void

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 15
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    /// A relay answers itself. A redirect is never followed, so no body or header goes elsewhere.
    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }

    func close() {
        session.finishTasksAndInvalidate()
    }

    func get(_ origin: URL, _ path: String, done: @escaping Answer) {
        send(URLRequest(url: origin.appendingPathComponent(path)), done: done)
    }

    func post(_ origin: URL, _ path: String, body: [String: Any], done: @escaping Answer) {
        var request = URLRequest(url: origin.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = RemoteCoding.json(body)
        send(request, done: done)
    }

    private func send(_ request: URLRequest, done: @escaping Answer) {
        session.dataTask(with: request) { data, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let object = data.flatMap(RemoteCoding.object) ?? [:]
            guard (200..<300).contains(status) else {
                let code = object["error"] as? String ?? (status == 0 ? "offline" : "failed")
                return done(.failure(RemoteFailure(code: code, message: Self.words(code))))
            }
            done(.success(object))
        }.resume()
    }

    private static func words(_ code: String) -> String {
        switch code {
        case "offline": return "The relay could not be reached."
        case "not-found", "pairing-unavailable": return "This pairing is no longer open. Start a new one on your computer."
        case "pairing-invalid": return "The pairing could not be completed. Start a new one on your computer."
        case "rate-limited": return "Too many attempts. Wait a moment and try again."
        default: return "The relay refused the request."
        }
    }
}
