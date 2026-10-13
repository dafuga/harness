import Foundation

/// Pairing as a session sees it: one attempt at a time, and only its own answers count.
extension RemoteSession {
    /// An attempt that was cancelled or replaced answers nothing: only the current one counts.
    func pair(_ input: RemotePairing.Input, done: @escaping (Result<[String: Any], RemoteFailure>) -> Void) {
        queue.async { done(self.begin(input)) }
    }

    /// Begins the one attempt, on the queue and within the turn of whoever asks: between the
    /// decision to pair and the attempt there is no later turn that anything could come before.
    func begin(_ input: RemotePairing.Input) -> Result<[String: Any], RemoteFailure> {
        guard record == nil, pairing == nil else {
            return .failure(.failed("Disconnect from the current computer first."))
        }
        let attempt = RemotePairing(input, queue: queue)
        pairing = attempt
        pending = input
        move("pairing")
        attempt.start(
            pending: { [weak self, weak attempt] in
                guard let self = self, self.pairing === attempt else { return }
                self.move("pending-approval")
            },
            done: { [weak self, weak attempt] result in
                guard let self = self, self.pairing === attempt else { return }
                self.paired(result)
            })
        return .success(snapshot)
    }

    /// A pairing that cannot be kept safely is not a pairing: the phone says why and stays apart.
    private func paired(_ result: Result<RemoteRecord, RemoteFailure>) {
        pairing = nil
        pending = nil
        switch result {
        case .failure(let failure): move("unpaired", reason: failure.message)
        case .success(let record):
            do {
                try vault.save(record)
            } catch {
                return move("unpaired", reason: (error as? RemoteFailure)?.message)
            }
            self.record = record
            authorize()
            connect()
        }
    }
}
