import Foundation

extension RemoteSession {
    static let trackerWriteMethod = "trackerReplicaPush"

    var trackerWriteScope: String? {
        record?.methods?.contains(Self.trackerWriteMethod) == true ? trackerScope : nil
    }

    func prepareTrackerWrite(
        _ action: String, input: [String: Any],
        done: @escaping (Result<TrackerReplicaConfirmation, TrackerReplicaWriteError>) -> Void
    ) {
        queue.async {
            guard let authority = self.trackerWriteScope else { return done(.failure(.denied)) }
            do {
                let confirmation = action == "discard_write"
                    ? try self.trackerStore.prepareDiscard(scope: authority, input: input)
                    : try self.trackerStore.prepareWrite(scope: authority, action: action, input: input)
                done(.success(confirmation))
            } catch let error as TrackerReplicaWriteError {
                done(.failure(error))
            } catch {
                done(.failure(.unavailable))
            }
        }
    }

    /// Called only by the native confirmation action. The reviewed scope and revision are retained.
    func confirmTrackerWrite(_ confirmation: TrackerReplicaConfirmation, done: @escaping ([String: Any]) -> Void) {
        queue.async {
            guard self.trackerWriteScope == confirmation.scope else {
                return done(self.trackerWriteReply(code: "denied"))
            }
            do {
                let intent = confirmation.intent
                let status: String
                if confirmation.discard {
                    try self.trackerStore.discardConflict(intent)
                    status = "discarded"
                } else {
                    try self.trackerStore.enqueueWrite(intent)
                    status = "queued"
                }
                done(self.trackerWriteReply(data: ["intentId": intent.intentId, "status": status]))
                self.drainTrackerWrites()
            } catch let error as TrackerReplicaWriteError {
                done(self.trackerWriteReply(code: error.rawValue))
            } catch {
                done(self.trackerWriteReply(code: "unavailable"))
            }
        }
    }

    func trackerWriteStatus() -> [String: Any] {
        guard trackerWriteScope != nil else { return trackerWriteReply(code: "denied") }
        do {
            return trackerWriteReply(data: ["writes": try trackerStore.writeStatus()])
        } catch let error as TrackerReplicaWriteError {
            return trackerWriteReply(code: error.rawValue)
        } catch {
            return trackerWriteReply(code: "unavailable")
        }
    }

    func trackerWriteReply(code: String? = nil, data: [String: Any]? = nil) -> [String: Any] {
        var reply: [String: Any] = [
            "source": "local_tracker", "lastSyncedAt": NSNull(), "freshness": "unavailable", "partial": true
        ]
        if let code = code { reply["code"] = code }
        if let data = data { reply["data"] = data }
        return reply
    }

}

extension RemoteSession {
    func drainTrackerWrites() {
        guard trackerForeground, state == "online", trackerWriteRequest == nil, let link = link,
            let authority = trackerWriteScope, let epoch = record?.epoch,
            let intent = try? trackerStore.nextWrite(),
            var input = (try? TrackerReplicaJSON.object(intent)) as? [String: Any]
        else { return }
        input["epoch"] = epoch
        trackerWriteRequest = intent.intentId
        let answer: RemoteRequests.Done = { [weak self, weak link] result in
            guard let self = self, let link = link, self.link === link,
                self.trackerWriteRequest == intent.intentId, self.trackerWriteScope == authority
            else { return }
            self.trackerWriteRequest = nil
            self.finishTrackerWrite(intent, result)
        }
        switch requests.add(method: Self.trackerWriteMethod, input: input, done: answer) {
        case .success(let packet):
            if !link.send(packet) { lose(nil) }
        case .failure(let failure):
            answer(.failure(failure))
        }
    }

    func cancelTrackerWrites() {
        trackerWriteRequest = nil
        requests.failMethod(Self.trackerWriteMethod, .superseded)
    }

    private func finishTrackerWrite(_ intent: TrackerReplicaIntent, _ result: Result<Any, RemoteFailure>) {
        if case .failure(let failure) = result {
            if failure.code == "method-denied" || failure.code == "revoked" {
                removeTrackerWriteGrant()
            } else if failure.code == "invalid-message" {
                recordWriteOutcome(intent, conflict: "invalidInput")
            }
            return
        }
        guard let receipt = (try? result.get()) as? [String: Any],
            receipt["intentId"] as? String == intent.intentId,
            let status = receipt["status"] as? String
        else { return }
        if status == "accepted" {
            recordWriteOutcome(intent, conflict: nil)
            pullTracker()
        } else if status == "conflict", let reason = receipt["reason"] as? String,
            ["item", "attention", "intent", "duplicate"].contains(reason) {
            recordWriteOutcome(intent, conflict: reason)
        } else {
            return
        }
    }

    private func recordWriteOutcome(_ intent: TrackerReplicaIntent, conflict: String?) {
        do {
            try trackerStore.finishWrite(intent, conflict: conflict)
            drainTrackerWrites()
        } catch {
            // A retained intent can retry safely after the next connection or refresh.
        }
    }

    private func removeTrackerWriteGrant() {
        guard var record = record else { return }
        record.methods?.removeAll { $0 == Self.trackerWriteMethod }
        keep(record)
    }
}
