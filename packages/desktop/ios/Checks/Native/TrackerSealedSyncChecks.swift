import Foundation

final class FixtureSealedSecrets: SealedSecretStore {
    var values: [String: Data] = [:]
    func load(_ name: String) -> Data? { values[name] }
    func save(_ name: String, _ data: Data) throws { values[name] = data }
    func remove(_ name: String) { values.removeValue(forKey: name) }
}

final class FixtureAccountVault: HubAccountVault {
    var credential: HubAccountCredential?
    func load() -> HubAccountCredential? { credential }
    func save(_ credential: HubAccountCredential) throws { self.credential = credential }
    func wipe() { credential = nil }
}

@MainActor
final class FixtureSealedSocket: TrackerSealedLiveTransport {
    var receive: ((URLSessionWebSocketTask.Message) -> Void)?
    var connected: Bool { receive != nil }
    var scopes: [String] = []
    var after: Int64 = -1

    func start(_ hub: TrackerSealedHub, scopes: [String], after: Int64,
        receive: @escaping (URLSessionWebSocketTask.Message) -> Void
    ) throws {
        self.scopes = scopes
        self.after = after
        self.receive = receive
    }

    func stop() { receive = nil }
}

final class FixtureSealedHub: HubAccountTransport {
    let device: String
    var objects: [String: String] = [:]
    var chain: [SealedChainEntry]
    var grants: [SealedJson] = []
    var requests: [URLRequest] = []
    var offline = false

    init(device: String, chain: [SealedChainEntry]) {
        self.device = device
        self.chain = chain
    }

    func send(_ request: URLRequest, done: @escaping (Result<HubAccountReply, HubAccountFailure>) -> Void) {
        requests.append(request)
        if offline { return done(.failure(.offline)) }
        let parts = request.url?.pathComponents ?? []
        switch parts.last {
        case "chain": return done(answer(.object(["entries": .array(chain.map(\.json)), "more": .bool(false)])))
        case "grants": return done(answer(.object(["grants": .array(grants)])))
        default: done(objectAnswer(parts, request: request))
        }
    }

    private func objectAnswer(_ parts: [String], request: URLRequest) -> Result<HubAccountReply, HubAccountFailure> {
        if parts.count == 6, let id = parts.last, let wire = objects[id] {
            return .success(HubAccountReply(status: 200, contentType: "text/plain", data: Data(wire.utf8)))
        }
        let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems
        let after = query?.first(where: { $0.name == "after" })?.value.flatMap(Int64.init) ?? 0
        let listing = objects.keys.sorted().enumerated().compactMap { index, id -> SealedJson? in
            guard index + 1 > after, let wire = objects[id], let data = RemoteCoding.data(base64url: wire),
                let header = try? SealedRecord.header(data), let rev = Int64(exactly: header.revision) else { return nil }
            return .object(["id": .string(id), "revision": .int(rev), "change": .int(Int64(index + 1)),
                            "size": .int(Int64(data.count))])
        }
        return answer(.object(["objects": .array(listing), "next": .int(max(after, Int64(objects.count))),
                               "more": .bool(false)]))
    }

    private func answer(_ value: SealedJson) -> Result<HubAccountReply, HubAccountFailure> {
        .success(HubAccountReply(status: 200, contentType: "application/json", data: Data(value.canonical.utf8)))
    }
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
func trackerSealedSyncChecks() async {
    let root = temporary("sealed-sync")
    defer { try? FileManager.default.removeItem(at: root) }
    do {
        let scenario = try TrackerSealedSyncFixture(root: root)
        let reader = scenario.reader
        defer { reader.stop() }
        try await reader.start()
        let caught = await waitForSealed { reader.status == "ready" }
        check(caught, "the native account replica verifies its pin and catches up from the Hub's object cursor")
        let text = try reader.cache.transcript(scenario.fixture.run, index: 0, keys: scenario.fixture.keys)
        check(text == Data(sessionTimingText.utf8), "a fresh account catches up to transcript text without a paired Mac")
        let headers = scenario.hub.requests
        check(!headers.isEmpty && headers.allSatisfy(scenario.isSignedRequest),
            "the native sync routes are origin-bound and credentials appear only in headers")
        try await checkOfflineAndRevoked(scenario)
    } catch {
        check(false, "native sealed account sync fixture completed")
    }
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
private func checkOfflineAndRevoked(_ scenario: TrackerSealedSyncFixture) async throws {
    let reader = scenario.reader
    let frame = try scenario.fixture.frame(ring: 10, counter: 0)
    scenario.socket.receive?(.data(frame))
    let ring = try reader.cache.ring()
    check(ring == 10 && scenario.socket.scopes == [scenario.fixture.scope.name],
        "the account socket subscribes to verified scopes and accepts an authenticated frame")
    reader.stop()
    scenario.hub.offline = true
    let reopened = TrackerSealedSessions(account: scenario.account, cache: reader.cache,
        keychain: scenario.store, live: scenario.socket)
    defer { reopened.stop() }
    try await reopened.start()
    let count = try reopened.summaries()["sessions"] as? [[String: Any]]
    check(count?.count == 1, "the reopened native bridge starts from cached keys and sessions before it contacts the Hub")
    reopened.stop()
    scenario.hub.offline = false
    try scenario.revoke()
    try await reopened.start()
    let revoked = await waitForSealed { reopened.status == "approval-required" }
    check(revoked && scenario.authority.load("session-scope-keys") == nil && !scenario.socket.connected,
          "a signed device revocation removes cached scope keys and closes the account socket")
    let remaining = try reopened.summaries()["sessions"] as? [[String: Any]]
    check(remaining?.isEmpty == true, "revocation clears in-memory session access")
}

@MainActor
private func waitForSealed(_ condition: () -> Bool) async -> Bool {
    for _ in 0..<150 {
        if condition() { return true }
        try? await Task.sleep(nanoseconds: 10_000_000)
    }
    return false
}
