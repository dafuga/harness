import Foundation

/// The link half of a session: connecting, `session.attach`, and every way a link ends
/// (backend-contract.md sections 2.3 and 8). A callback of a link that is no longer the current
/// one changes nothing: it cannot restore a state, deliver data or send a request.
extension RemoteSession: RemoteLinkDelegate {
    func dropLink() {
        handshake?.cancel()
        link?.delegate = nil
        link?.close()
        link = nil
        attachId = nil
    }

    func connect() {
        guard let record = record else { return }
        dropLink()
        move("connecting")
        let link = makeLink(record, queue)
        link.delegate = self
        self.link = link
        let limit = DispatchWorkItem { [weak self, weak link] in
            guard let self = self, let link = link, self.link === link else { return }
            self.lose("The computer did not answer in time.")
        }
        handshake = limit
        queue.asyncAfter(deadline: .now() + RemoteLimits.handshakeSeconds, execute: limit)
        link.open()
    }

    /// Offline is said at once, and a change that was not confirmed is reported as uncertain
    /// instead of being sent again. The next attempt waits longer each time, up to half a minute.
    func lose(_ words: String?) {
        guard record != nil else { return }
        dropLink()
        requests.failChanges(.uncertain)
        move("offline", reason: words)
        attempts += 1
        let wait = min(30.0, pow(2.0, Double(min(attempts, 5))))
        queue.asyncAfter(deadline: .now() + wait) { [weak self] in
            guard let self = self, self.state == "offline", self.link == nil else { return }
            self.connect()
        }
    }

    func revoke() {
        forget()
        move("revoked")
    }

    /// A new generation is a new approval: what was kept under the old one leaves before the
    /// attach is even asked.
    func linkReady(_ link: RemoteLink, generation: Int) {
        guard link === self.link, var record = record else { return }
        if generation != record.generation {
            record.generation = generation
            keep(record)
        }
        let id = UUID().uuidString.lowercased()
        let resume: Any = record.epoch.map { ["epoch": $0, "sequence": record.sequence] } ?? NSNull()
        let input: [String: Any] = [
            "protocol": 1, "client": ["kind": "ios", "name": String(record.deviceName.prefix(80))], "resume": resume
        ]
        let request: [String: Any] = ["type": "request", "id": id, "method": "session.attach", "input": input]
        attachId = id
        if let message = RemoteCoding.json(request) { _ = link.send(message) }
    }

    func link(_ link: RemoteLink, closed closure: RemoteLinkClosure) {
        guard link === self.link else { return }
        switch closure {
        case .revoked: revoke()
        case .hostOffline:
            attachId = nil
            requests.failChanges(.uncertain)
            if state != "offline" { move("offline", reason: "The computer is asleep or has no network.") }
        case .lost: lose(nil)
        }
    }

    func link(_ link: RemoteLink, received message: Data) {
        guard link === self.link else { return }
        guard let object = RemoteCoding.object(message), let type = object["type"] as? String else { return lose(nil) }
        if type == "event" { return event(object) }
        guard type == "response" else { return lose(nil) }
        if object["id"] as? String == attachId { return attached(object) }
        let refusal = object["ok"] as? Bool == false ? object["error"] as? [String: Any] : nil
        if requests.answer(object), let code = refusal?["code"] as? String { denied(code) }
    }

    /// Only now is the computer online, with exactly the methods it attached. Reads that were
    /// not answered go out again under their first ids; changes were already reported as
    /// uncertain when the link was lost, whatever the epoch of the computer is now.
    private func attached(_ response: [String: Any]) {
        attachId = nil
        handshake?.cancel()
        guard response["ok"] as? Bool == true, let value = response["value"] as? [String: Any],
            let epoch = value["epoch"] as? String, var record = record
        else {
            let error = response["error"] as? [String: Any]
            return error?["code"] as? String == "revoked" ? revoke() : lose(error?["message"] as? String)
        }
        let host = value["host"] as? [String: Any]
        if value["replay"] as? String != "resumed" { record.sequence = value["sequence"] as? Int ?? 0 }
        record.epoch = epoch
        record.hostName = host?["name"] as? String ?? record.hostName
        record.grant = RemoteGrant(value["grant"]) ?? record.grant
        record.methods = (value["methods"] as? [String] ?? []).filter(RemoteMethods.allowed)
        record.lastOnlineAt = RemoteCoding.now()
        keep(record)
        locked = host?["locked"] as? Bool
        attempts = 0
        move("online")
        requests.unanswered.forEach { _ = self.link?.send($0) }
    }
}
