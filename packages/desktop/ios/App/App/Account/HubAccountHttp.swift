import Foundation

/// Which Hub this build asks, and what the page may ask of it. The origin is fixed when the app
/// is built (`HarnessHubOrigin` = `$(HARNESS_HUB_ORIGIN)` in Info.plist): nothing at run time
/// names another, and a build without one has no account at all.
enum HubAccountPolicy {
    static let infoKey = "HarnessHubOrigin"
    /// What a project is read for, and the two things written to it: comments and agent calls.
    private static let reads: Set<String> = [
        "snapshot", "entity", "history", "source", "threads", "image", "evidence", "artifact"
    ]
    private static let writes: Set<String> = ["comments", "agent"]
    private static let project = "\\A[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\z"
    private static let field = "\\A[A-Za-z]{1,40}\\z"
    private static let plain = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    /// An exact https origin of another machine, written in its canonical form: no path, no user
    /// information, no query, no capital letters, and never this device.
    static func origin(_ value: Any?) -> URL? {
        guard let text = value as? String, let url = URL(string: text), url.scheme == "https",
            let host = url.host, !host.isEmpty, host == host.lowercased(), !local(host)
        else { return nil }
        let port = url.port.map { ":\($0)" } ?? ""
        return text == "https://\(host)\(port)" ? url : nil
    }

    /// The project list, the reads, media and evidence of one project, and its comments and
    /// agent calls. Sign-in, sign-out and every other route of the Hub are never asked for the page.
    static func allowed(_ call: HubAccountCall) -> Bool {
        let parts = call.path.components(separatedBy: "/")
        guard parts.count == 3 || parts.count == 5, parts[0].isEmpty, parts[1] == "api", parts[2] == "projects",
            fields(call.query), (call.body?.count ?? 0) <= HubAccountLimits.bodyBytes
        else { return false }
        if parts.count == 3 { return call.method == "GET" && call.body == nil }
        guard matches(parts[3], project) else { return false }
        if call.method == "GET" { return call.body == nil && reads.contains(parts[4]) }
        return call.method == "POST" && call.query.isEmpty && writes.contains(parts[4])
    }

    /// A request to the Hub: JSON, no cookie and no cache. A session travels in its header only,
    /// and every field is escaped whole, so that nothing in one is read as another.
    static func request(_ origin: URL, _ call: HubAccountCall, token: String?) -> URLRequest? {
        var parts = URLComponents()
        parts.scheme = "https"
        parts.host = origin.host
        parts.port = origin.port
        parts.path = call.path
        let query = call.query.sorted { $0.key < $1.key }.compactMap { item in
            item.value.addingPercentEncoding(withAllowedCharacters: plain).map { "\(item.key)=\($0)" }
        }
        if !query.isEmpty { parts.percentEncodedQuery = query.joined(separator: "&") }
        guard query.count == call.query.count, let url = parts.url, url.host == origin.host else { return nil }
        var request = URLRequest(
            url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: HubAccountLimits.seconds)
        request.httpMethod = call.method
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body = call.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token = token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    static func matches(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: .regularExpression) != nil
    }

    private static func fields(_ query: [String: String]) -> Bool {
        query.count <= HubAccountLimits.queryItems
            && query.allSatisfy { matches($0.key, field) && $0.value.count <= HubAccountLimits.queryValue }
    }

    private static func local(_ host: String) -> Bool {
        ["localhost", "::1", "0.0.0.0"].contains(host) || host.hasPrefix("127.") || host.hasSuffix(".local")
    }
}

/// How the session reaches the Hub. The app's is URLSession; a check hands in its own, so that
/// no check reaches the network.
protocol HubAccountTransport {
    func send(_ request: URLRequest, done: @escaping (Result<HubAccountReply, HubAccountFailure>) -> Void)
}

/// The one HTTP client of the account: an ephemeral session with no cookie, cache or stored
/// credential. A redirect is never followed, so no header or body goes elsewhere, and an answer
/// stops being read at its limit.
final class HubAccountHttp: NSObject, HubAccountTransport, URLSessionDataDelegate {
    typealias Done = (Result<HubAccountReply, HubAccountFailure>) -> Void
    private struct Pending {
        let done: Done
        var status = 0
        var type = ""
        var data = Data()
        var redirected = false
        var large = false
    }

    /// Every delegate call and every change of `pending` happens here, one at a time.
    private let queue: OperationQueue = {
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        return queue
    }()
    private var pending: [Int: Pending] = [:]
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.urlCredentialStorage = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = HubAccountLimits.seconds
        return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
    }()

    func send(_ request: URLRequest, done: @escaping Done) {
        let task = session.dataTask(with: request)
        queue.addOperation {
            self.pending[task.taskIdentifier] = Pending(done: done)
            task.resume()
        }
    }

    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) {
        pending[task.taskIdentifier]?.redirected = true
        completionHandler(nil)
    }

    func urlSession(
        _ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        let http = response as? HTTPURLResponse
        let large = response.expectedContentLength > Int64(HubAccountLimits.replyBytes)
        pending[dataTask.taskIdentifier]?.status = http?.statusCode ?? 0
        pending[dataTask.taskIdentifier]?.type = http?.value(forHTTPHeaderField: "Content-Type") ?? ""
        pending[dataTask.taskIdentifier]?.large = large
        completionHandler(large ? .cancel : .allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard var item = pending[dataTask.taskIdentifier] else { return }
        item.data.append(data)
        if item.data.count > HubAccountLimits.replyBytes {
            item.large = true
            item.data = Data()
            dataTask.cancel()
        }
        pending[dataTask.taskIdentifier] = item
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let item = pending.removeValue(forKey: task.taskIdentifier) else { return }
        item.done(Self.outcome(item, error))
    }

    private static func outcome(_ item: Pending, _ error: Error?) -> Result<HubAccountReply, HubAccountFailure> {
        if item.large { return .failure(.tooLarge) }
        if item.redirected || (300..<400).contains(item.status) { return .failure(.redirected) }
        guard error == nil, item.status >= 100 else { return .failure(.offline) }
        return .success(HubAccountReply(status: item.status, contentType: item.type, data: item.data))
    }
}
