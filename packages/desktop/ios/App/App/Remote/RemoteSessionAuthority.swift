import Foundation

/// Under which authority a session keeps and answers anything: the record of its pairing. When
/// that changes, or the computer itself refuses, what was kept and what still waits under the
/// earlier belief leaves at once; nothing of it reaches the page later.
extension RemoteSession {
    /// The scope of the saved copies; nil when nothing is paired.
    var scope: String? {
        record.map(RemoteCache.scope(of:))
    }

    /// What was kept under any other authority leaves now; without a record nothing is kept.
    func authorize() {
        if let scope = scope { cache.enter(scope) } else { cache.purge() }
    }

    /// Keeps a changed record. A new grant or a new generation of the approval ends every
    /// request that was asked under the old one: a read as superseded, a change as uncertain.
    func keep(_ record: RemoteRecord) {
        let before = scope
        self.record = record
        try? vault.save(record)
        authorize()
        guard before != nil, before != scope else { return }
        requests.failChanges(.uncertain)
        requests.failAll(.superseded)
    }

    /// The computer answered a request by refusing it. A revocation ends the pairing; any other
    /// refusal of permission means the copies were kept, and the waiting reads asked, under a
    /// belief that no longer holds. A change that waits keeps waiting for its own answer.
    func denied(_ code: String) {
        if code == "revoked" { return revoke() }
        guard RemoteFailure.denials.contains(code) else { return }
        cache.purge()
        authorize()
        requests.failReads(.superseded)
    }
}
