import Foundation

/// One real `RemoteSession` on a bench: a pairing in memory, a cache in a temporary folder and
/// links that reach nothing. A check plays the computer by answering on a link.
final class Bench {
    static let methods = [
        "listProjects", "capabilities", "snapshot", "entity", "history", "source", "image", "messages",
        "pendingComments", "providers", "addComment", "openThread", "createPlan", "approve", "startRun",
        "cancelRun"
    ]
    static let grant: [String: Any] = ["projects": [["id": "local-1", "name": "One"]], "agents": true]

    let vault: MemoryVault
    let root: URL
    let cache: RemoteCache
    var links: [FakeLink] = []
    var statuses: [[String: Any]] = []
    var events: [[String: Any]] = []
    private(set) var session: RemoteSession!

    /// A pairing as the Keychain would hold it. Its secret fields are random and never printed.
    static func record(generation: Int = 1) -> RemoteRecord {
        RemoteRecord(
            origin: "https://relay.example.invalid", hostId: String(repeating: "a1", count: 20), hostKey: "AA",
            hostName: "Check Mac", deviceId: String(repeating: "d4", count: 20), deviceName: "Check phone",
            deviceSecret: RemoteCoding.base64url(RemoteCoding.random(32)),
            credential: RemoteCoding.base64url(RemoteCoding.random(32)), generation: generation,
            grant: RemoteGrant(grant)!, lastOnlineAt: nil, epoch: nil, sequence: 0, methods: nil)
    }

    init(
        record: RemoteRecord? = Bench.record(), root: URL = temporary("cache"),
        budget: RemoteCacheBudget = .standard
    ) {
        self.root = root
        vault = MemoryVault(record)
        cache = RemoteCache(root: root, budget: budget)
        session = RemoteSession(vault: vault, cache: cache) { [weak self] _, _ in
            let link = FakeLink()
            self?.links.append(link)
            return link
        }
        session.onStatus = { [weak self] in self?.statuses.append($0) }
        session.onEvent = { [weak self] in self?.events.append($0) }
    }

    var link: FakeLink { links[links.count - 1] }
    var state: String { session.queue.sync { session.state } }
    var status: [String: Any] { session.queue.sync { session.snapshot } }

    func settle() {
        session.queue.sync {}
    }

    func start() {
        session.start()
        settle()
    }

    func ready(_ link: FakeLink, generation: Int = 1) {
        session.queue.sync { session.linkReady(link, generation: generation) }
    }

    func deliver(_ link: FakeLink, _ object: [String: Any]) {
        guard let message = RemoteCoding.json(object) else { return }
        session.queue.sync { session.link(link, received: message) }
    }

    func close(_ link: FakeLink, _ closure: RemoteLinkClosure) {
        session.queue.sync { session.link(link, closed: closure) }
    }

    /// The computer's answer to the attach of this link, as section 2.3 of the contract has it.
    func attachment(epoch: String, methods: [String], grant: [String: Any], locked: Bool?) -> [String: Any] {
        var host: [String: Any] = ["id": String(repeating: "a1", count: 20), "name": "Check Mac", "platform": "darwin"]
        if let locked = locked { host["locked"] = locked }
        return [
            "protocol": 1, "role": "device", "epoch": epoch, "sequence": 0, "replay": "none", "host": host,
            "device": ["id": String(repeating: "d4", count: 20), "name": "Check phone"], "grant": grant,
            "methods": methods, "limits": [String: Any]()
        ]
    }

    /// What the computer answers an attach with in a check; the defaults are a full grant.
    struct Answer {
        var epoch = "epoch-1"
        var methods = Bench.methods
        var grant = Bench.grant
        var locked: Bool?
    }

    func attach(_ answer: Answer = Answer(), generation: Int = 1) {
        let link = self.link
        ready(link, generation: generation)
        let id = link.asked("session.attach").last?["id"] as? String ?? ""
        let value = attachment(epoch: answer.epoch, methods: answer.methods, grant: answer.grant, locked: answer.locked)
        deliver(link, ["type": "response", "id": id, "ok": true, "value": value])
    }

    func online() {
        start()
        attach()
    }

    func ask(_ method: String, _ input: [String: Any] = ["projectId": "local-1"]) -> Reply {
        let reply = Reply()
        session.request(method: method, input: input) { reply.result = $0 }
        settle()
        return reply
    }

    /// Answers the newest request of this method on the link, as the computer would.
    func answer(_ link: FakeLink, _ method: String, value: Any) {
        let id = link.asked(method).last?["id"] as? String ?? ""
        deliver(link, ["type": "response", "id": id, "ok": true, "value": value])
    }

    func event(_ link: FakeLink, _ channel: String, _ sequence: Int, _ value: [String: Any]) {
        deliver(link, ["type": "event", "channel": channel, "sequence": sequence, "value": value])
    }
}

/// What the person does with the phone during a check.
extension Bench {
    /// The app came back to the front: a lost computer is tried again at once.
    func reconnect() {
        session.resume()
        settle()
    }

    func disconnect() {
        let done = DispatchSemaphore(value: 0)
        session.disconnect { _ in done.signal() }
        _ = done.wait(timeout: .now() + 2)
        settle()
    }
}
