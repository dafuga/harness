import Foundation

/// The heartbeat of a link: a ping at every interval, and the link is lost when the one before
/// was not answered (backend-contract.md section 5.2).
final class RemotePulse {
    private var timer: DispatchSourceTimer?
    private var waiting = false

    func start(on queue: DispatchQueue, ping: @escaping () -> Void, lost: @escaping () -> Void) {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + RemoteLimits.pingSeconds, repeating: RemoteLimits.pingSeconds)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            if self.waiting { return lost() }
            self.waiting = true
            ping()
        }
        timer.resume()
        self.timer = timer
    }

    func answered() {
        waiting = false
    }

    func stop() {
        timer?.cancel()
        timer = nil
    }
}
