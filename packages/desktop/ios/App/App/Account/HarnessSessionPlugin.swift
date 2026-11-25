import Capacitor
import Foundation

/// A view of sealed account sessions. The WebView holds displayed text only for the current page.
@available(iOS 17.0, *)
@objc(HarnessSessionPlugin)
public final class HarnessSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HarnessSessionPlugin"
    public let jsName = "HarnessSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcript", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "live", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    @MainActor private lazy var replica = TrackerSealedSessions(account: HarnessAccountPlugin.sharedSession)

    override public func load() {
        let account = HarnessAccountPlugin.sharedSession
        account.queue.async {
            account.sealedAccountEnded = { [weak self] generation, namespace in
                Task { @MainActor in self?.replica.erase(generation: generation, namespace: namespace) }
            }
        }
        Task { @MainActor in
            self.replica.changed = { [weak self] in self?.notifyListeners("changed", data: [:]) }
        }
    }

    @objc func list(_ call: CAPPluginCall) {
        perform(call) { try self.replica.summaries() }
    }

    @objc func transcript(_ call: CAPPluginCall) {
        perform(call) {
            let (run, keys) = try self.selection(call)
            guard let index = call.getInt("index"), index >= 0 else { throw HubAccountFailure.refused }
            guard let page = try self.replica.cache.transcriptPage(run, index: Int64(index), keys: keys)
            else { return ["data": NSNull()] }
            var reply: [String: Any] = ["data": page.data.base64EncodedString()]
            reply["captured"] = page.captured
            return reply
        }
    }

    @objc func live(_ call: CAPPluginCall) {
        perform(call) {
            let (run, keys) = try self.selection(call)
            let cursor = TrackerReplicaFrameCursor(stream: call.getString("stream"),
                counter: call.getString("after").flatMap(UInt64.init))
            return try self.replica.cache.live(run, keys: keys, cursor: cursor)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        Task { @MainActor in
            replica.stop()
            call.resolve()
        }
    }

    @MainActor private func selection(_ call: CAPPluginCall) throws -> (String, TrackerReplicaSessionKeys) {
        guard let name = call.getString("scope"), name.utf8.count == 22,
            let run = call.getString("runId"), !run.isEmpty, run.utf8.count <= 256
        else { throw HubAccountFailure.refused }
        return (run, try replica.scope(name))
    }

    private func perform(_ call: CAPPluginCall, _ read: @escaping @MainActor () throws -> [String: Any]) {
        Task { @MainActor in
            do {
                try await replica.start()
                call.resolve(try read())
            } catch {
                let failure = error as? HubAccountFailure ?? .failed
                call.reject(failure.message, failure.code)
            }
        }
    }
}
