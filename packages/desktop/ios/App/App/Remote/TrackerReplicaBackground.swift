import Foundation

extension RemoteSession {
    func setTrackerForeground(_ foreground: Bool) {
        queue.async {
            self.trackerForeground = foreground
            self.followTracker()
            if foreground {
                if self.trackerBackground != nil { self.finishTrackerBackground(.unchanged) }
                if self.state == "online" { self.pullTracker() } else { self.resume() }
            } else {
                self.cancelTracker()
                if self.trackerScope != nil { self.closeTrackerLink() }
            }
        }
    }

    func beginTrackerBackground(id: UUID = UUID(), _ done: @escaping (TrackerRefreshResult) -> Void) {
        queue.async {
            guard !self.trackerForeground, self.trackerBackground == nil,
                let scope = self.trackerScope
            else { return done(.unchanged) }
            self.trackerStore.enter(scope)
            guard let position = try? self.trackerStore.state(), position.cursor != nil
            else { return done(.unchanged) }
            let deadline = DispatchWorkItem { [weak self] in self?.finishTrackerBackground(.failed) }
            self.trackerBackground = TrackerBackgroundAttempt(id: id, complete: done, expiration: deadline)
            self.queue.asyncAfter(deadline: .now() + 15, execute: deadline)
            if self.state == "online" { self.pullTracker() } else { self.connect() }
        }
    }

    func expireTrackerBackground(_ id: UUID? = nil) {
        queue.async {
            guard id == nil || id == self.trackerBackground?.id else { return }
            self.finishTrackerBackground(.failed)
        }
    }

    func acceptTrackerBackground(_ page: TrackerReplicaPage, more: Bool) {
        guard var attempt = trackerBackground else { return }
        attempt.remaining -= 1
        attempt.updated = attempt.updated || (page.operations?.isEmpty == false)
        trackerBackground = attempt
        let result: TrackerRefreshResult = attempt.updated ? .updated : .unchanged
        guard more && attempt.remaining > 0 && page.kind != "reset" else {
            return finishTrackerBackground(result)
        }
        queue.async { [weak self] in self?.pullTracker() }
    }

    func finishTrackerBackground(_ result: TrackerRefreshResult) {
        guard let attempt = trackerBackground else { return }
        trackerBackground = nil
        attempt.expiration.cancel()
        cancelTracker()
        if !trackerForeground { closeTrackerLink() }
        attempt.complete(result)
    }

    private func closeTrackerLink() {
        guard record != nil, link != nil else { return }
        dropLink()
        requests.failChanges(.uncertain)
        move("offline")
    }
}
