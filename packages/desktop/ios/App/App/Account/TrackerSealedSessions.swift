import Foundation

/// The renderer asks for local views. Sync runs independently of those reads on the main actor,
/// which also serializes the SQLite cache and fences off results from a previous account.
@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class TrackerSealedSessions {
    let cache: TrackerReplicaSealed
    private let account: HubAccountSession
    private let live: TrackerSealedLiveTransport
    private let keychain: SealedSecretStore
    private var identity: TrackerSealedIdentity?
    private var scopes: [String: TrackerReplicaSessionKeys] = [:]
    private var pulse: Task<Void, Never>?
    private var update: Task<Void, Never>?
    private var pending = false
    private var floor = 0
    private var stopping = 0
    private(set) var status = "connecting"
    var changed: () -> Void = {}

    init(account: HubAccountSession, cache: TrackerReplicaSealed = TrackerReplicaSealed(),
        keychain: SealedSecretStore = SealedKeychain(), live: TrackerSealedLiveTransport? = nil
    ) {
        self.account = account
        self.cache = cache
        self.keychain = keychain
        self.live = live ?? TrackerSealedLive()
    }

    private func authority(_ identity: TrackerSealedIdentity) -> TrackerSealedAuthority {
        TrackerSealedAuthority(identity: identity, keychain: keychain)
    }

    func start() async throws {
        let asked = stopping
        guard let current = await account.sealedIdentity(), current.generation >= floor, stopping == asked else {
            throw HubAccountFailure.signedOut
        }
        if identity?.generation == current.generation, identity?.namespace == current.namespace, pulse != nil { return }
        stop()
        identity = current
        cache.enter(current.namespace)
        let authority = authority(current)
        guard let pin = try authority.pin() else {
            status = "approval-required"
            return
        }
        let cached = try authority.cached(pin)
        scopes = cached
        status = "connecting"
        schedule()
        pulse = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                if !Task.isCancelled { self?.schedule() }
            }
        }
    }

    func stop() {
        stopping += 1
        live.stop()
        pulse?.cancel()
        update?.cancel()
        pulse = nil
        update = nil
        pending = false
        scopes = [:]
        status = "connecting"
    }

    func erase(generation: Int, namespace: String?) {
        guard generation >= floor else { return }
        floor = generation
        guard identity.map({ $0.generation < generation }) != false else { return }
        stop()
        if let namespace = namespace ?? identity?.namespace {
            keychain.remove("enroll-\(namespace)-session-scope-keys")
        }
        identity = nil
        cache.purge()
        changed()
    }

    func scope(_ name: String) throws -> TrackerReplicaSessionKeys {
        guard let scope = scopes[name] else { throw HubAccountFailure.refused }
        return scope
    }

    func summaries() throws -> [String: Any] {
        ["sessions": try cache.sessions(scopes), "state": status]
    }

    private func schedule() {
        guard let identity else { return }
        if update != nil { pending = true; return }
        update = Task {
            defer { if !Task.isCancelled { finished() } }
            do {
                try await refresh(authority(identity))
            } catch is TrackerSealedRevoked {
                if !Task.isCancelled { revoked() }
            } catch let failure as HubAccountFailure where failure == .signedOut {
                if !Task.isCancelled { account.endSealedIdentity(identity) }
            } catch {
                if !Task.isCancelled { status = "offline" }
            }
        }
    }

    private func finished() {
        update = nil
        changed()
        if pending { pending = false; schedule() }
    }

    private func revoked() {
        stop()
        cache.purge()
        status = "approval-required"
        changed()
    }

}

@available(iOS 17.0, macOS 14.0, *)
extension TrackerSealedSessions {
    private func refresh(_ authority: TrackerSealedAuthority) async throws {
        guard let device = try authority.device() else { throw HubAccountFailure.refused }
        let hub = TrackerSealedHub(identity: authority.identity, device: device.deviceId, transport: account.transport)
        let verified = try await authority.verifiedKeys(hub, device: device)
        try Task.checkCancellation()
        let names = verified.keys.sorted()
        let changedScopes = scopes.keys.sorted() != names
        scopes = verified
        if changedScopes || !live.connected {
            try live.start(hub, scopes: names, after: cache.ring()) { [weak self] in self?.receive($0) }
        }
        for name in names {
            if let scope = scopes[name] { try await hub.catchUp(cache, scope: scope) }
        }
        status = "ready"
    }

    private func receive(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .data(let bytes): receiveFrame(bytes)
        case .string(let text): receiveNotice(text)
        @unknown default: break
        }
    }

    private func receiveFrame(_ bytes: Data) {
        guard let frame = try? TrackerReplicaLiveFrame(bytes),
            let scope = scopes[RemoteCoding.base64url(frame.header.scopeId)],
            frame.header.epoch == scope.current.epoch else { return }
        do {
            try cache.accept(frame, keys: scope.current)
            changed()
        } catch { /* An unauthenticated frame never advances the local cursor. */ }
    }

    private func receiveNotice(_ text: String) {
        guard text.utf8.count <= 4096, let notice = try? SealedJson.parse(Data(text.utf8)) else { return }
        if notice["t"]?.text == "poke", notice["kind"]?.text == "objects",
            let scope = notice["scope"]?.text, scopes[scope] != nil { schedule() }
        if notice["t"]?.text == "subscribed", let ring = notice["ring"]?.number,
            let saved = try? cache.ring(), ring < saved {
            try? cache.resetRing()
            live.stop()
            schedule()
        }
    }
}
