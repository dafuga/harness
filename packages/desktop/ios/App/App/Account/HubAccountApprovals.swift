import Foundation

extension HubAccountSession {
    func approvalRequests(_ done: @escaping Status) {
        withApprovalTransport(done) { transport in
            transport.requests { result in
                if case .success(let reply) = result, let rows = reply["requests"] as? [[String: Any]] {
                    self.notifyNewApprovals(rows.compactMap { $0["id"] as? String })
                }
                done(result)
            }
        }
    }

    private func notifyNewApprovals(_ ids: [String]) {
        guard let approvalAlert else { return }
        let time = now()
        let expires = time.addingTimeInterval(15 * 60)
        notifiedApprovals = notifiedApprovals.filter { $0.value > time }
        var changed = false
        for id in ids {
            if notifiedApprovals.updateValue(expires, forKey: id) == nil { changed = true }
        }
        if changed { approvalAlert() }
    }

    func reviewApproval(_ id: String, done: @escaping Status) {
        guard HubApprovalTransport.validID(id) else { return done(.failure(.refused)) }
        withApprovalTransport(done) { transport in
            self.approvalReviews = self.approvalReviews.filter { $0.value.expires > self.now() }
            let review = self.approvalReviews[id] ?? HubLoginReview(id: id, now: self.now())
            guard self.approvalReviews[id] != nil || self.approvalReviews.count < HubApprovalTransport.limit
            else { return done(.failure(.refused)) }
            self.approvalReviews[id] = review
            review.review(transport, done)
        }
    }

    func approveDevice(_ id: String, code: String, authenticate: @escaping HubLoginReview.Authentication,
                       done: @escaping Status) {
        withApprovalTransport(done) { transport in
            guard #available(iOS 17.0, macOS 14.0, *), let review = self.approvalReviews[id], review.expires > self.now()
            else { return done(.failure(.refused)) }
            review.approve(code: code, via: transport, authenticate: authenticate) { result in
                if case .success = result { self.approvalReviews.removeValue(forKey: id) }
                done(result)
            }
        }
    }

    func denyDevice(_ id: String, done: @escaping Status) {
        guard HubApprovalTransport.validID(id) else { return done(.failure(.refused)) }
        withApprovalTransport(done) { transport in
            transport.send(HubApprovalTransport.inbox + "/" + id, body: RemoteCoding.json(["deny": true])) { result in
                do {
                    guard try result.get()["denied"] == .bool(true) else { throw HubAccountFailure.failed }
                    self.approvalReviews.removeValue(forKey: id)
                    done(.success(["state": "denied"]))
                } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        }
    }

    private func withApprovalTransport(_ done: @escaping Status, _ work: @escaping (HubApprovalTransport) -> Void) {
        queue.async {
            self.withApprovedDevice { result in
                do {
                    let credential = try result.get()
                    guard let admitted = self.enrolledDevice,
                        let device = try SealedDeviceStore.load(from: HubLoginDeviceStore(credential, base: self.loginKeys))
                    else { throw HubAccountFailure.refused }
                    let ledger = HubLoginLedger(session: self, credential: credential, device: device)
                    work(HubApprovalTransport(ledger: ledger, admitted: admitted))
                } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        }
    }
}
