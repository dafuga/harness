import Foundation

/// One look through the camera: which one it is, the camera, and who waits for its answer.
struct RemoteLook {
    let id: Int
    let scanner: RemoteScanner
    let done: RemoteSession.Paired
}

/// Scanning as a session sees it. One look through the camera is under way at a time, and only
/// that look may start a pairing: leaving ends it, and what its camera reads afterwards asks
/// nobody. A look stays under way until the very turn in which its pairing begins, so nothing
/// can come between the two. A scan is trusted for nothing else; its text is still read by the
/// rule of an offer.
extension RemoteSession {
    typealias Paired = (Result<[String: Any], RemoteFailure>) -> Void

    /// Opens the camera for an unpaired phone that is neither scanning nor pairing already.
    func scan(_ scanner: RemoteScanner, deviceName: String, done: @escaping Paired) {
        queue.async {
            guard self.record == nil, self.pairing == nil, self.look == nil else {
                return done(.failure(.failed("Finish or leave what is under way first.")))
            }
            self.looks += 1
            let id = self.looks
            self.look = RemoteLook(id: id, scanner: scanner, done: done)
            scanner.scan { outcome in
                self.queue.async { self.looked(id, outcome, deviceName: deviceName) }
            }
        }
    }

    /// What a camera read counts only while its look is the one under way. An offer is asked
    /// with one turn later, and the look stays under way until then: a Disconnect that already
    /// waits behind this answer comes first, ends the look, and the offer asks nobody.
    private func looked(_ id: Int, _ outcome: RemoteScanOutcome, deviceName: String) {
        guard let look = look, look.id == id else { return }
        switch RemoteScanFlow.input(outcome, deviceName: deviceName) {
        case .failure(let failure):
            self.look = nil
            look.done(.failure(failure.failure))
        case .success(let input):
            queue.async { self.asked(id, with: input) }
        }
    }

    /// Ends the look and begins its pairing in one turn, if that look is still the one under way.
    private func asked(_ id: Int, with input: RemotePairing.Input) {
        guard let look = look, look.id == id else { return }
        self.look = nil
        look.done(begin(input))
    }

    /// Ends the look that is under way: its camera goes away, the page is told once that the
    /// scan was cancelled, and whatever that camera still answers is not heard.
    func endLook() {
        guard let look = look else { return }
        self.look = nil
        look.scanner.cancel()
        look.done(.failure(RemoteScanFailure.cancelled.failure))
    }
}
