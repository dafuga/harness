import Foundation

enum TrackerRefreshResult: Equatable {
    case updated
    case unchanged
    case failed
}

struct TrackerBackgroundAttempt {
    let id: UUID
    let complete: (TrackerRefreshResult) -> Void
    let expiration: DispatchWorkItem
    var remaining = 2
    var updated = false
}

extension RemoteSession {
    static let trackerMethod = "trackerReplicaPull"

    var trackerScope: String? {
        record?.methods?.contains(Self.trackerMethod) == true ? scope : nil
    }

    func trackerTool(_ name: String, input: [String: Any], done: @escaping ([String: Any]) -> Void) {
        queue.async {
            if name == "tracker_write_status", input.isEmpty { return done(self.trackerWriteStatus()) }
            guard self.trackerScope != nil else {
                return done(["source": "local_tracker", "lastSyncedAt": NSNull(),
                             "freshness": "unavailable", "partial": true, "code": "denied"])
            }
            done(self.trackerStore.tool(name, input: input, online: self.state == "online", now: self.trackerStore.now()))
        }
    }

    func refreshTracker() {
        queue.async {
            self.trackerDelay = 60
            self.pullTracker()
        }
    }

    func trackerConnectionChanged(_ next: String) {
        if next == "online" {
            trackerDelay = 60
            pullTracker()
            drainTrackerWrites()
        } else if next != "connecting" {
            cancelTracker()
            if trackerBackground != nil { finishTrackerBackground(.failed) }
        }
    }

    func authorizeTracker() {
        let next = trackerScope
        if trackerAuthority != next { cancelTracker() }
        trackerAuthority = next
        trackerStore.enter(next)
        if trackerWriteScope == nil {
            cancelTrackerWrites()
            guard next != nil else { return }
            do { try trackerStore.purgeWrites() } catch {
                trackerStore.purge()
                trackerStore.enter(next)
            }
        }
    }

    func cancelTracker() {
        trackerTimer?.cancel()
        trackerTimer = nil
        trackerRequest = nil
        requests.failMethod(Self.trackerMethod, .superseded)
        cancelTrackerWrites()
    }

}

extension RemoteSession {
    func pullTracker() {
        trackerTimer?.cancel()
        trackerTimer = nil
        guard trackerForeground || trackerBackground != nil, trackerRequest == nil, state == "online",
            let link = link, let authority = trackerScope
        else { return }
        do {
            trackerStore.enter(authority)
            let position = try trackerPosition(authority)
            if trackerBackground != nil && position.cursor == nil { return finishTrackerBackground(.unchanged) }
            sendTracker(position, link: link, authority: authority)
        } catch {
            postponeTracker()
        }
    }

    private func trackerPosition(_ authority: String) throws -> TrackerReplicaState {
        let local = try trackerStore.state()
        let now = trackerStore.now().timeIntervalSince1970
        if let renewal = local.renewedAt, now - renewal >= 7 * 86_400 {
            trackerStore.purge()
            trackerStore.enter(authority)
            return TrackerReplicaState()
        }
        return local
    }

    private func sendTracker(_ position: TrackerReplicaState, link: RemoteLink, authority: String) {
        let token = UUID()
        trackerRequest = token
        let answer: RemoteRequests.Done = { [weak self, weak link] result in
            guard let self = self, let link = link, self.link === link, self.trackerRequest == token,
                self.trackerScope == authority
            else { return }
            self.trackerRequest = nil
            self.acceptTracker(result, position: position)
        }
        switch requests.add(method: Self.trackerMethod, input: position.input, done: answer) {
        case .success(let packet):
            if !link.send(packet) { lose(nil) }
        case .failure(let failure):
            answer(.failure(failure))
        }
    }

    private func acceptTracker(_ result: Result<Any, RemoteFailure>, position: TrackerReplicaState) {
        do {
            let page = try TrackerReplicaPage.decode(result.get())
            if page.code == "denied" { return removeTrackerGrant() }
            if page.kind == "reset" && position.cursor == nil && position.continuation == nil {
                throw TrackerReplicaError.invalidPage
            }
            let more = try trackerStore.apply(page, expected: position, now: trackerStore.now())
            if trackerBackground != nil { return acceptTrackerBackground(page, more: more) }
            trackerDelay = 60
            if more {
                queue.async { [weak self] in self?.pullTracker() }
            } else {
                drainTrackerWrites()
                scheduleTracker(60)
            }
        } catch let failure as RemoteFailure where RemoteFailure.denials.contains(failure.code) {
            removeTrackerGrant()
        } catch {
            postponeTracker()
        }
    }

    private func removeTrackerGrant() {
        guard var record = record else { return }
        record.methods?.removeAll { $0 == Self.trackerMethod }
        keep(record)
        trackerStore.purge()
        if trackerBackground != nil { finishTrackerBackground(.failed) }
    }

    private func postponeTracker() {
        if trackerBackground != nil { return finishTrackerBackground(.failed) }
        let wait = min(3600, trackerDelay + Double.random(in: 0...(trackerDelay / 5)))
        trackerDelay = min(3600, trackerDelay * 2)
        scheduleTracker(wait)
    }

    private func scheduleTracker(_ delay: Double) {
        guard trackerForeground else { return }
        let task = DispatchWorkItem { [weak self] in self?.pullTracker() }
        trackerTimer = task
        queue.asyncAfter(deadline: .now() + delay, execute: task)
    }
}
