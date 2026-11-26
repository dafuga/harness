import Foundation

/// What a session keeps to turn the account's notices into pulls and to tell the open page.
struct TrackerLiveState {
    var doorbell: TrackerDoorbell?
    /// A notice arrived while a pull was in flight, whose answer may predate the change.
    var again = false
    /// The copy changed since the page was last told.
    var moved = false
    /// No pull has completed since pushes stopped: the page's freshness may be out of date.
    var behind = true
    var shown = "reconnecting"
}

/// The live half of the replica: each notice and each reconnect pulls, and the page is told when
/// the copy moved. It is "live" only while a notice can arrive and the computer can be pulled.
extension RemoteSession {
    func useTrackerDoorbell(_ doorbell: TrackerDoorbell) {
        queue.async {
            doorbell.rang = { [weak self] in self?.trackerNotice() }
            doorbell.moved = { [weak self] in
                self?.trackerLive.behind = true
                self?.reportTracker()
            }
            self.trackerLive.doorbell = doorbell
            self.followTracker()
        }
    }

    /// The socket is open only in front of the person, under a grant to read the tracker.
    func followTracker() {
        if trackerForeground && trackerScope != nil {
            trackerLive.doorbell?.start()
        } else {
            trackerLive.doorbell?.stop()
        }
    }

    /// The app is in front again: a socket that waits to be reopened is tried at once.
    func retryTrackerPush() {
        queue.async { self.trackerLive.doorbell?.retryNow() }
    }

    /// One pull is in flight at a time; a notice during it asks for exactly one more.
    func trackerNotice() {
        if state == "offline" { resume() }
        if trackerRequest != nil {
            trackerLive.again = true
        } else {
            pullTracker()
        }
    }

    /// True when a notice was waiting for the pull that just ended; it is then taken.
    func takeTrackerNotice() -> Bool {
        let waiting = trackerLive.again
        trackerLive.again = false
        return waiting
    }

    /// A pull reached the end of what the computer had.
    func trackerCaughtUp() {
        guard trackerLive.moved || trackerLive.behind else { return }
        trackerLive.moved = false
        trackerLive.behind = false
        reportTracker(changed: true)
    }

    private var trackerPushState: String {
        trackerLive.doorbell?.live == true && state == "online" ? "live" : "reconnecting"
    }

    /// The page hears of a change of the copy, and of the link only when that differs.
    func reportTracker(changed: Bool = false) {
        let next = trackerPushState
        guard changed || next != trackerLive.shown else { return }
        trackerLive.shown = next
        onTrackerChange?(["state": next, "changed": changed])
    }

    func trackerPush(_ done: @escaping ([String: Any]) -> Void) {
        queue.async { done(["state": self.trackerPushState]) }
    }
}

extension TrackerReplicaPage {
    /// Whether applying this page can change what a read answers: only an empty delta cannot.
    var changesCopy: Bool {
        kind != "delta" || operations?.isEmpty == false
    }
}
