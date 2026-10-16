import Foundation

/// Requests that wait for the computer. A read keeps its id and may be sent again after a
/// reconnect. A change is never sent twice: when the link is lost before its answer, it ends as
/// uncertain, because this side cannot know whether the computer ran it. None waits past its
/// deadline, and one that was not answered is a failure, never a success.
final class RemoteRequests {
    typealias Done = (Result<Any, RemoteFailure>) -> Void

    private struct Entry {
        let id: String
        let change: Bool
        let message: Data
        let done: Done
        let deadline: DispatchWorkItem
    }

    private var entries: [Entry] = []
    private let queue: DispatchQueue

    init(queue: DispatchQueue) {
        self.queue = queue
    }

    /// The wire message of a new request, or why it cannot wait here.
    func add(method: String, input: [String: Any], done: @escaping Done) -> Result<Data, RemoteFailure> {
        guard entries.count < RemoteLimits.pendingRequests else { return .failure(.tooMany) }
        let id = UUID().uuidString.lowercased()
        let request: [String: Any] = ["type": "request", "id": id, "method": method, "input": input]
        guard let message = RemoteCoding.json(request) else { return .failure(.invalid) }
        guard message.count <= RemoteLimits.requestBytes else { return .failure(.tooLarge) }
        let change = RemoteMethods.changes.contains(method)
        let deadline = DispatchWorkItem { [weak self] in self?.finish(id, .failure(.deadline)) }
        let seconds = change ? RemoteLimits.mutationSeconds : RemoteLimits.requestSeconds
        queue.asyncAfter(deadline: .now() + seconds + 5, execute: deadline)
        entries.append(Entry(id: id, change: change, message: message, done: done, deadline: deadline))
        return .success(message)
    }

    /// True when the response belonged to a waiting request.
    func answer(_ response: [String: Any]) -> Bool {
        guard let id = response["id"] as? String, entries.contains(where: { $0.id == id }) else { return false }
        if response["ok"] as? Bool == true {
            finish(id, .success(response["value"] ?? NSNull()))
        } else {
            let error = response["error"] as? [String: Any]
            let code = error?["code"] as? String ?? "failed"
            let message = error?["message"] as? String ?? "The computer could not complete this request."
            finish(id, .failure(RemoteFailure(code: code, message: message)))
        }
        return true
    }

    /// The reads that are sent again, in their first order, once the computer is reached again.
    var unanswered: [Data] {
        entries.filter { !$0.change }.map { $0.message }
    }

    /// Changes that were under way when the link ended: reported, and never sent again.
    func failChanges(_ failure: RemoteFailure) {
        entries.filter { $0.change }.map { $0.id }.forEach { finish($0, .failure(failure)) }
    }

    /// Reads that still wait when the computer refused this phone something: none is answered.
    func failReads(_ failure: RemoteFailure) {
        entries.filter { !$0.change }.map { $0.id }.forEach { finish($0, .failure(failure)) }
    }

    func failAll(_ failure: RemoteFailure) {
        entries.map { $0.id }.forEach { finish($0, .failure(failure)) }
    }

    private func finish(_ id: String, _ result: Result<Any, RemoteFailure>) {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return }
        let entry = entries.remove(at: index)
        entry.deadline.cancel()
        entry.done(result)
    }
}
