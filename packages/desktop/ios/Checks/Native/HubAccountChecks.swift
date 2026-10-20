import Foundation

// The rules of the Hub account on the real `HubAccountSession`, `HubAccountPolicy` and `HubAccountHttp`.
// The vault is memory and the Hub is played here: no network but loopback fixtures, no real keychain.

/// Where a check keeps an account session: memory only.
final class MemoryAccountVault: HubAccountVault {
    var credential: HubAccountCredential?
    var wipes = 0
    init(_ credential: HubAccountCredential? = nil) { self.credential = credential }
    func load() -> HubAccountCredential? { credential }
    func save(_ credential: HubAccountCredential) throws { self.credential = credential }
    func wipe() {
        credential = nil
        wipes += 1
    }
}

/// A Hub a check plays by method and path. It records every request; `holding` keeps answers back.
final class FakeHub: HubAccountTransport {
    var routes: [String: (URLRequest) -> HubAccountReply] = [:]
    var seen: [URLRequest] = []
    var holding = false
    var held: [() -> Void] = []
    func send(_ request: URLRequest, done: @escaping (Result<HubAccountReply, HubAccountFailure>) -> Void) {
        seen.append(request)
        let route = routes["\(request.httpMethod ?? "") \(request.url?.path ?? "")"]
        let result: Result<HubAccountReply, HubAccountFailure> = route.map { .success($0(request)) } ?? .failure(.offline)
        if holding { held.append { done(result) } } else { done(result) }
    }
    func asked(_ path: String) -> [URLRequest] { seen.filter { $0.url?.path == path } }
    func body(_ path: String) -> [String: Any] { asked(path).last?.httpBody.flatMap(RemoteCoding.object) ?? [:] }
    func bearer(_ path: String) -> String? { asked(path).last?.value(forHTTPHeaderField: "Authorization") }
}

extension Result {
    var refusal: Failure? { if case .failure(let failure) = self { return failure } else { return nil } }
}

/// Waits until what was asked answers, a few seconds at most.
private func awaited<T>(_ ask: (@escaping (T) -> Void) -> Void) -> T? {
    var result: T?
    ask { result = $0 }
    wait { result != nil }
    return result
}

private let hubOrigin = URL(string: "https://hub.example.invalid")!
private let hubProject = "/api/projects/11111111-1111-4111-8111-111111111111"
private let hubToken = String(repeating: "t", count: 43)
private let hubHandoff = String(repeating: "h", count: 43)
private let hubAda: [String: Any] = ["id": "google:ada", "name": "Ada", "email": "ada@example.invalid", "emailVerified": true]
private let hubKept = HubAccountCredential(origin: hubOrigin.absoluteString, subject: "google:ada", name: "Ada",
    email: "ada@example.invalid", token: hubToken, expiresAt: Date(timeIntervalSince1970: 1_900_000_000))

private func hubJSON(_ status: Int, _ object: [String: Any]) -> HubAccountReply {
    HubAccountReply(status: status, contentType: "application/json", data: RemoteCoding.json(object) ?? Data())
}

/// One real `HubAccountSession` with a vault in memory, a Hub played here and a clock moved here.
private final class AccountBench {
    let vault: MemoryAccountVault
    let hub: FakeHub
    let session: HubAccountSession
    var time = Date(timeIntervalSince1970: 1_800_000_000)
    var opened: [URL] = []
    init(origin: URL? = hubOrigin, vault: MemoryAccountVault = MemoryAccountVault()) {
        let hub = FakeHub()
        self.vault = vault
        self.hub = hub
        session = HubAccountSession(origin: origin, vault: vault, transport: hub)
        session.now = { [unowned self] in self.time }
        session.open = { [unowned self] in self.opened.append($0) }
    }
    func status() -> Result<[String: Any], HubAccountFailure>? { awaited(session.status) }
    func connect() -> Result<[String: Any], HubAccountFailure>? { awaited(session.connect) }
    func disconnect() -> Result<[String: Any], HubAccountFailure>? { awaited(session.disconnect) }
    func request(_ path: String, _ method: String = "GET") -> Result<HubAccountReply, HubAccountFailure>? { awaited { self.session.request(HubAccountCall(method: method, path: path), $0) } }
    /// Connects to a Hub whose sign-in the person approves; `change` alters what its exchange answers.
    @discardableResult
    func waiting(_ change: [String: Any] = [:], page: String? = nil) -> Result<[String: Any], HubAccountFailure>? {
        let start: [String: Any] = ["handoffId": hubHandoff, "userCode": "WXYZ-2345", "interval": 2, "verificationUrl":
            page ?? "\(hubOrigin.absoluteString)/native/\(hubHandoff)", "expiresAt": ISO8601DateFormatter().string(from: time + 300)]
        hub.routes["POST /api/auth/native/start"] = { _ in hubJSON(200, start) }
        hub.routes["POST /api/auth/native/poll"] = { _ in hubJSON(200, ["status": "approved"]) }
        hub.routes["POST /api/auth/native/exchange"] = { request in
            let asked = request.httpBody.flatMap(RemoteCoding.object) ?? [:]
            let issued: [String: Any] = ["authorization": hubToken, "audience": "harness-desktop", "resource": asked["resource"] ?? "",
                "nonce": asked["nonce"] ?? "", "expiresAt": "2030-01-01T00:00:00.000Z", "actor": hubAda]
            return hubJSON(200, issued.merging(change) { $1 })
        }
        hub.routes["GET /api/auth/status"] = { _ in hubJSON(200, ["configured": true, "actor": hubAda]) }
        return connect()
    }
    func signIn() {
        waiting()
        time += 2
        _ = status()
    }
}

func accountPolicyChecks() {
    let refused: [Any?] = [nil, "", "$(HARNESS_HUB_ORIGIN)", "http://hub.example.invalid", "https://hub.example.invalid/", "https://Hub.example.invalid",
        "https://hub.example.invalid/api", "https://ada@hub.example.invalid", "https://hub.example.invalid?x=1", "https://127.0.0.1:8787"]
    check(HubAccountPolicy.origin(hubOrigin.absoluteString) != nil && refused.allSatisfy { HubAccountPolicy.origin($0) == nil }, "account: only the exact https origin of another machine is the Hub")
    let unset = AccountBench(origin: nil)
    let disabled = (try? unset.status()?.get())?["configured"] as? Bool == false && unset.connect()?.refusal == .notConfigured
    check(disabled && unset.request("/api/projects")?.refusal == .notConfigured && unset.hub.seen.isEmpty && unset.opened.isEmpty, "account: a build without an origin is not configured, sends nothing and opens nothing")
    let asked = [("GET", "/api/projects"), ("GET", "\(hubProject)/snapshot"), ("GET", "\(hubProject)/artifact"), ("POST", "\(hubProject)/comments"), ("POST", "\(hubProject)/agent")]
    check(asked.allSatisfy { HubAccountPolicy.allowed(HubAccountCall(method: $0.0, path: $0.1)) }, "account: project reads, media, comments and agent calls may be asked")
    let denied = [("POST", "/api/auth/native/start"), ("GET", "/api/auth/status"), ("POST", "/api/auth/logout"), ("GET", "/api/github/status"), ("POST", "/api/projects"),
        ("DELETE", "\(hubProject)/members/x"), ("POST", "\(hubProject)/invitations"), ("POST", "\(hubProject)/snapshot"), ("GET", "\(hubProject)/../../auth/status"),
        ("GET", hubProject.uppercased() + "/snapshot"), ("GET", "https://other.example.invalid/api/projects"), ("GET", "/api/projects/"), ("GET", "\(hubProject)/snapshot?x=1")]
    check(denied.allSatisfy { !HubAccountPolicy.allowed(HubAccountCall(method: $0.0, path: $0.1)) }, "account: sign-in, sign-out, other routes, methods and addresses are refused")
    let odd = [HubAccountCall(method: "GET", path: "/api/projects", query: ["x-y": "1"]), HubAccountCall(method: "GET", path: "/api/projects", body: Data("{}".utf8)),
        HubAccountCall(method: "POST", path: "\(hubProject)/comments", body: Data(count: HubAccountLimits.bodyBytes + 1))]
    let typed: [AnyHashable: Any] = ["method": "GET", "path": "/api/projects", "query": ["page": 2]]
    check(odd.allSatisfy { !HubAccountPolicy.allowed($0) } && HubAccountCall(typed) == nil, "account: odd field names, a body on a read, an oversized body and fields that are no text are refused")
    let fielded = HubAccountCall(method: "GET", path: "\(hubProject)/source", query: ["path": "a+b&c=d/é", "commit": "c"])
    let request = HubAccountPolicy.request(hubOrigin, fielded, token: hubToken)
    let address = request?.url?.absoluteString ?? ""
    check(HubAccountPolicy.allowed(fielded) && address.hasSuffix("?commit=c&path=a%2Bb%26c%3Dd%2F%C3%A9"), "account: each field is escaped whole and none is read as another")
    check(request?.value(forHTTPHeaderField: "Authorization") == "Bearer \(hubToken)" && request?.url?.host == hubOrigin.host && !address.contains(hubToken), "account: the session goes in a header to the configured Hub, never in an address")
}

func accountSignInChecks() {
    let bench = AccountBench()
    let pending = try? bench.waiting()?.get()
    let start = bench.hub.body("/api/auth/native/start")
    check(pending?["state"] as? String == "pending" && bench.opened.map(\.absoluteString) == ["\(hubOrigin.absoluteString)/native/\(hubHandoff)"], "account: Connect opens the Hub's approval page in the system browser and waits")
    check(start["resource"] as? String == "projects" && (start["challenge"] as? String)?.count == 43 && ((start["nonce"] as? String)?.count ?? 0) >= 22, "account: the start asks for the projects with an S256 challenge and a nonce")
    check(bench.status() != nil && bench.hub.asked("/api/auth/native/poll").isEmpty, "account: the Hub is not polled before its interval")
    bench.time += 2
    let signed = try? bench.status()?.get()
    let exchange = bench.hub.body("/api/auth/native/exchange")
    let verifier = exchange["verifier"] as? String ?? "-"
    let proved = RemoteCoding.base64url(RemoteCoding.sha256(Data(verifier.utf8))) == start["challenge"] as? String
    check(proved && exchange["nonce"] as? String == start["nonce"] as? String, "account: the exchange proves the verifier of that challenge and repeats its nonce")
    let person = (signed?["actor"] as? [String: Any])?["id"] as? String == "google:ada" && bench.vault.credential?.token == hubToken
    check(signed?["state"] as? String == "signed-in" && person && bench.hub.bearer("/api/auth/status") == "Bearer \(hubToken)", "account: an approved sign-in is kept and signed in once the Hub confirms its person")
    let shown = String(describing: [pending ?? [:], signed ?? [:]])
    check(![hubToken, verifier, start["nonce"] as? String ?? "-"].contains { shown.contains($0) }, "account: no status holds the session, the verifier or the nonce")
    let reused = AccountBench(vault: bench.vault)
    reused.hub.routes["GET /api/auth/status"] = { _ in hubJSON(200, ["configured": true, "actor": hubAda]) }
    check((try? reused.status()?.get())?["state"] as? String == "signed-in" && reused.hub.asked("/api/auth/status").count == 1, "account: a kept session is confirmed by the Hub again when it is reused")
}

func accountBindingChecks() {
    let unverified = hubAda.merging(["emailVerified": false]) { $1 }
    let changes: [(String, [String: Any])] = [("nonce", ["nonce": "another-nonce-of-another-sign-in"]), ("audience", ["audience": "harness-web"]),
        ("resource", ["resource": "project:x"]), ("expiry", ["expiresAt": "2020-01-01T00:00:00.000Z"]), ("identity", ["actor": unverified])]
    for (name, change) in changes {
        let bench = AccountBench()
        bench.waiting(change)
        bench.time += 2
        check(bench.status()?.refusal == .expired && bench.vault.credential == nil, "account: an exchange bound to another \(name) is not kept")
        check(bench.hub.asked("/api/auth/logout").count == 1, "account: the session issued for it is ended at the Hub (\(name))")
    }
    let foreign = AccountBench()
    check(foreign.waiting(page: "https://other.example.invalid/native/\(hubHandoff)")?.refusal != nil && foreign.opened.isEmpty, "account: an approval page of another origin is never opened")
    let late = AccountBench()
    late.waiting()
    late.time += 301
    check((try? late.status()?.get())?["state"] as? String == "signed-out" && late.hub.asked("/api/auth/native/poll").isEmpty, "account: an expired code is not polled and signs nobody in")
    let cancelled = AccountBench()
    cancelled.waiting()
    _ = cancelled.disconnect()
    cancelled.time += 2
    check((try? cancelled.status()?.get())?["state"] as? String == "signed-out" && cancelled.hub.asked("/api/auth/native/exchange").isEmpty, "account: a sign-in ended by Disconnect is never exchanged")
}

func accountRequestChecks() {
    let bench = AccountBench()
    bench.signIn()
    bench.hub.routes["GET /api/projects"] = { _ in HubAccountReply(status: 200, contentType: "application/json", data: Data("[]".utf8)) }
    let listed = (try? bench.request("/api/projects")?.get())?.object ?? [:]
    let signed = listed["data"] as? String == "W10=" && bench.hub.bearer("/api/projects") == "Bearer \(hubToken)"
    check(signed && !String(describing: listed).contains(hubToken), "account: a project read is signed here and answered as status, type and base64, without the session")
    let before = bench.hub.seen.count
    check(bench.request("/api/auth/logout", "POST")?.refusal == .refused && bench.hub.seen.count == before, "account: an auth route asked by the page is refused and never sent")
    bench.hub.holding = true
    var late: Result<HubAccountReply, HubAccountFailure>?
    bench.session.request(HubAccountCall(method: "GET", path: "/api/projects")) { late = $0 }
    wait { !bench.hub.held.isEmpty }
    let ended = try? bench.disconnect()?.get()
    bench.hub.held.forEach { $0() }
    wait { late != nil }
    check(late?.refusal == .superseded, "account: an answer asked for before Disconnect reaches nobody")
    check(ended?["state"] as? String == "signed-out" && bench.vault.credential == nil && bench.vault.wipes > 0, "account: Disconnect erases the session from the vault")
    check(bench.hub.bearer("/api/auth/logout") == "Bearer \(hubToken)" && bench.request("/api/projects")?.refusal == .signedOut, "account: Disconnect ends the session at the Hub, and nothing is signed after it")
}

func accountReuseChecks() {
    let denied = AccountBench(vault: MemoryAccountVault(hubKept))
    denied.hub.routes["GET /api/projects"] = { _ in hubJSON(401, ["error": "session-required"]) }
    check((try? denied.request("/api/projects")?.get())?.status == 401 && denied.vault.credential == nil, "account: a 401 reaches the page as one and ends the session here")
    let eve = hubAda.merging(["id": "google:eve"]) { $1 }
    let other = AccountBench(vault: MemoryAccountVault(hubKept))
    other.hub.routes["GET /api/auth/status"] = { _ in hubJSON(200, ["configured": true, "actor": eve]) }
    check(other.status()?.refusal == .mismatch && other.vault.credential == nil && other.hub.asked("/api/auth/logout").count == 1, "account: a kept session the Hub names another person for is erased and ended")
    let forgotten = AccountBench(vault: MemoryAccountVault(hubKept))
    forgotten.hub.routes["GET /api/auth/status"] = { _ in hubJSON(200, ["configured": true, "actor": NSNull()]) }
    check((try? forgotten.status()?.get())?["state"] as? String == "signed-out" && forgotten.vault.credential == nil, "account: a session the Hub no longer knows is erased")
    var moved = hubKept
    moved.origin = "https://old.example.invalid"
    let elsewhere = AccountBench(vault: MemoryAccountVault(moved))
    check(elsewhere.request("/api/projects")?.refusal == .signedOut && elsewhere.hub.seen.isEmpty, "account: a session of another Hub is erased and never sent")
}

func accountHttpChecks() {
    let target = LocalServer { _ in Data("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".utf8) }
    let moving = LocalServer { _ in Data("HTTP/1.1 307 Redirect\r\nLocation: http://127.0.0.1:\(target.port)/taken\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8) }
    let huge = LocalServer { _ in Data("HTTP/1.1 200 OK\r\nContent-Length: 20000000\r\nConnection: close\r\n\r\n".utf8) + Data(repeating: 65, count: 20_000_000) }
    let http = HubAccountHttp()
    let fetch = { (server: LocalServer) -> Result<HubAccountReply, HubAccountFailure>? in awaited { http.send(URLRequest(url: URL(string: "http://127.0.0.1:\(server.port)/api")!), done: $0) } }
    check(fetch(moving)?.refusal == .redirected && target.seen.isEmpty, "account: a redirect of the Hub is refused and nothing goes to the other address")
    check(fetch(huge)?.refusal == .tooLarge, "account: an answer larger than its limit is refused before it is read")
    check((try? fetch(target)?.get())?.status == 200, "account: control, the same client reads an ordinary answer")
    [target, moving, huge].forEach { $0.stop() }
}
