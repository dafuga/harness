import Foundation

/// What the page may ask, and what answers it. Only what the computer attached is asked at all.
/// A read the computer cannot answer now is answered from the copy the phone kept, with the
/// time it was saved. A change is never kept and never answered from a copy: while the computer
/// is away it is refused as offline. A change names the epoch of the attach it was asked under,
/// so that a computer that restarted meanwhile refuses it instead of running it a second time.
extension RemoteSession {
    func request(method: String, input: [String: Any], done: @escaping Reply) {
        queue.async {
            guard RemoteMethods.allowed(method), self.record?.methods?.contains(method) == true else {
                return done(.failure(.denied))
            }
            guard self.state == "online", let link = self.link else { return done(self.kept(method, input)) }
            let asked = self.scope
            var sent = input
            if RemoteMethods.changes.contains(method) { sent["epoch"] = self.record?.epoch }
            let answered: RemoteRequests.Done = { [weak self] result in
                if case .success(let value) = result { self?.store(asked, method, input, value) }
                done(result.map { RemoteAnswer(value: $0, cachedAt: nil) })
            }
            switch self.requests.add(method: method, input: sent, done: answered) {
            case .failure(let failure): done(.failure(failure))
            case .success(let message): if !link.send(message) { self.lose(nil) }
            }
        }
    }

    private func kept(_ method: String, _ input: [String: Any]) -> Result<RemoteAnswer, RemoteFailure> {
        guard RemoteMethods.reads.contains(method), let scope = scope,
            let answer = cache.read(scope: scope, method: method, input: input)
        else { return .failure(.offline) }
        return .success(answer)
    }

    /// An answer is kept only under the authority it was asked under, and only while that one
    /// still holds: one that arrives after a revocation or a changed grant is not kept.
    private func store(_ asked: String?, _ method: String, _ input: [String: Any], _ value: Any) {
        guard let asked = asked, asked == scope else { return }
        cache.save(scope: asked, method: method, input: input, value: value)
    }
}
