import Foundation

/// This phone's connection to one computer: its state and what it keeps of it
/// (backend-contract.md section 8). Every state it reports is one it is in: only a computer
/// that answered the attach is online. Pairing, reads, authority, events and the link are in the
/// files beside it.
final class RemoteSession {
    typealias Reply = (Result<RemoteAnswer, RemoteFailure>) -> Void
    typealias LinkFactory = (RemoteRecord, DispatchQueue) -> RemoteLink

    var onStatus: (([String: Any]) -> Void)?
    var onEvent: (([String: Any]) -> Void)?

    let queue = DispatchQueue(label: "com.dafuga.harness.remote")
    let vault: RemoteVault
    let cache: RemoteCache
    let makeLink: LinkFactory
    lazy var requests = RemoteRequests(queue: queue)
    var record: RemoteRecord?
    var state = "unpaired"
    var reason: String?
    /// Whether the computer's screen is locked, as it last said; nil when it did not say.
    var locked: Bool?
    var pending: RemotePairing.Input?
    var pairing: RemotePairing?
    /// The look through the camera that is under way, and how many there have been.
    var look: RemoteLook?
    var looks = 0
    var link: RemoteLink?
    var attachId: String?
    var attempts = 0
    var handshake: DispatchWorkItem?

    init(
        vault: RemoteVault = RemoteKeychain(), cache: RemoteCache = RemoteCache(),
        makeLink: @escaping LinkFactory = { RemoteChannel(record: $0, queue: $1) }
    ) {
        self.vault = vault
        self.cache = cache
        self.makeLink = makeLink
    }

    func start() {
        queue.async {
            self.record = self.vault.load()
            self.authorize()
            if self.record != nil { self.connect() }
        }
    }

    func status(_ done: @escaping ([String: Any]) -> Void) {
        queue.async { done(self.snapshot) }
    }

    /// The app came back to the front: a lost computer is tried again without waiting.
    func resume() {
        queue.async {
            guard self.record != nil, self.state == "offline" else { return }
            self.attempts = 0
            self.connect()
        }
    }

    /// Forgets the computer: the credential and the keys leave the Keychain before anything else.
    /// A scan that is open ends with it: what its camera reads afterwards asks nobody.
    func disconnect(_ done: @escaping ([String: Any]) -> Void) {
        queue.async {
            self.endLook()
            self.forget()
            self.move("unpaired")
            done(self.snapshot)
        }
    }

    /// `RemoteMobileStatus` with what the last attach allowed beside it: public identifiers and
    /// words. No key, credential or code is in it. A lock state is stated only when known.
    var snapshot: [String: Any] {
        let host: Any = record.map { ["id": $0.hostId, "name": $0.hostName] }
            ?? pending.map { ["id": $0.hostId, "name": "your computer"] } ?? NSNull()
        let device: Any = record.map { ["id": $0.deviceId, "name": $0.deviceName] } ?? NSNull()
        var status: [String: Any] = [
            "state": state,
            "origin": record?.origin ?? pending?.origin ?? NSNull(),
            "host": host,
            "device": device,
            "grant": record?.grant.object ?? NSNull(),
            "reason": reason ?? NSNull(),
            "lastOnlineAt": record?.lastOnlineAt ?? NSNull(),
            "methods": record?.methods ?? []
        ]
        if state == "online", let locked = locked { status["locked"] = locked }
        #if DEBUG
        if RemoteDebug.loopback { status["fixture"] = true }
        #endif
        return status
    }

    func move(_ next: String, reason: String? = nil) {
        state = next
        self.reason = reason
        if next != "online" { locked = nil }
        onStatus?(snapshot)
    }

    func forget() {
        vault.wipe()
        cache.purge()
        pairing?.cancel()
        pairing = nil
        pending = nil
        record = nil
        dropLink()
        requests.failAll(.offline)
    }
}
