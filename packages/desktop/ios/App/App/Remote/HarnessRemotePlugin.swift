import Capacitor
import Foundation
import LocalAuthentication
import UIKit

/// The one bridge between the page and this phone's connection to a computer. The page gets a
/// state, answers and events; the socket, the keys, the credential and the saved copies stay
/// on this side, and nothing of them is logged or handed over.
@objc(HarnessRemotePlugin)
public class HarnessRemotePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HarnessRemotePlugin"
    public let jsName = "HarnessRemote"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "computers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connectAccountComputer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trackerTool", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshTracker", returnType: CAPPluginReturnPromise)
    ]

    private let session = TrackerRefresh.session

    override public func load() {
        session.onStatus = { [weak self] status in self?.notifyListeners("status", data: status) }
        session.onEvent = { [weak self] event in self?.notifyListeners("event", data: event) }
        session.start()
    }

    @objc func trackerTool(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), let input = call.options["input"] as? [String: Any] else {
            return call.reject(RemoteFailure.invalid.message, RemoteFailure.invalid.code)
        }
        let writes = ["tracker_note", "tracker_flag", "tracker_answer", "tracker_done", "tracker_remind",
                      "tracker_discard_write"]
        if writes.contains(name) {
            confirmTrackerWrite(String(name.dropFirst(8)), input: input, call: call)
        } else {
            session.trackerTool(name, input: input) { call.resolve($0) }
        }
    }

    private func confirmTrackerWrite(_ action: String, input: [String: Any], call: CAPPluginCall) {
        session.prepareTrackerWrite(action, input: input) { [weak self] result in
            DispatchQueue.main.async {
                guard let self = self else { return call.reject("The write could not be confirmed.") }
                switch result {
                case .failure(let failure):
                    call.resolve(self.session.trackerWriteReply(code: failure.rawValue))
                case .success(let confirmation):
                    self.presentTrackerWrite(confirmation, call: call)
                }
            }
        }
    }

    @MainActor
    private func presentTrackerWrite(_ confirmation: TrackerReplicaConfirmation, call: CAPPluginCall) {
        guard let presenter = bridge?.viewController, presenter.presentedViewController == nil,
            UIApplication.shared.applicationState == .active
        else { return call.resolve(session.trackerWriteReply(code: "unavailable")) }
        let intent = confirmation.intent
        let choice = intent.option.map { "Option \($0): " + intent.text }
        let message = [confirmation.itemTitle, confirmation.question, choice ?? Self.readable(intent)]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n\n")
        let verb = intent.action == "remind" ? "snooze" : intent.action
        let title = confirmation.discard ? "Discard queued Tracker write" : "Queue Tracker " + verb
        let button = confirmation.discard ? "Discard" : "Queue " + verb
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [session] _ in
            call.resolve(session.trackerWriteReply(code: "cancelled"))
        })
        alert.addAction(UIAlertAction(title: button, style: confirmation.discard ? .destructive : .default) { [session] _ in
            self.confirmedByOwner(confirmation) { allowed in
                guard allowed else { return call.resolve(session.trackerWriteReply(code: "cancelled")) }
                session.confirmTrackerWrite(confirmation) { call.resolve($0) }
            }
        })
        presenter.present(alert, animated: true)
    }

    /// A snooze's text is a time, shown in the phone's own format.
    private static func readable(_ intent: TrackerReplicaIntent) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard intent.action == "remind", let time = parser.date(from: intent.text) else { return intent.text }
        return "Until " + DateFormatter.localizedString(from: time, dateStyle: .medium, timeStyle: .short)
    }

    /// Deploy, money and secret asks need Face ID (or the passcode) on top of the confirm dialog.
    private func confirmedByOwner(_ confirmation: TrackerReplicaConfirmation, done: @escaping (Bool) -> Void) {
        guard let kind = confirmation.confirm, !confirmation.discard else { return done(true) }
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { return done(false) }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Confirm this \(kind) answer") { allowed, _ in
            DispatchQueue.main.async { done(allowed) }
        }
    }

    @objc func refreshTracker(_ call: CAPPluginCall) {
        session.refreshTracker()
        call.resolve()
    }

    @objc func status(_ call: CAPPluginCall) {
        session.status { call.resolve($0) }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        session.disconnect { call.resolve($0) }
    }

    /// An answer says whether it is a saved copy: `cachedAt` is the time it was kept, or null.
    @objc func request(_ call: CAPPluginCall) {
        guard let method = call.getString("method") else {
            return call.reject(RemoteFailure.invalid.message, RemoteFailure.invalid.code)
        }
        let input = call.options["input"] as? [String: Any] ?? [:]
        session.request(method: method, input: input) { result in
            switch result {
            case .success(let answer):
                call.resolve(["value": answer.value, "cachedAt": answer.cachedAt ?? NSNull()])
            case .failure(let failure): call.reject(failure.message, failure.code)
            }
        }
    }
}

extension HarnessRemotePlugin {
    @objc func computers(_ call: CAPPluginCall) {
        HarnessAccountPlugin.sharedSession.computers { result in
            switch result {
            case .success(let computers): call.resolve(["computers": computers])
            case .failure(let failure): call.reject(failure.message, failure.code)
            }
        }
    }

    @objc func connectAccountComputer(_ call: CAPPluginCall) {
        guard let hostId = call.getString("hostId"), let name = RemotePairing.deviceName(call.getString("deviceName"))
        else { return call.reject(RemoteFailure.invalid.message, RemoteFailure.invalid.code) }
        HarnessAccountPlugin.sharedSession.computerPairing(hostId, name: name) { result in
            switch result {
            case .failure(let failure): call.reject(failure.message, failure.code)
            case .success(let input):
                self.session.pair(input) { paired in
                    switch paired {
                    case .success(let status): call.resolve(status)
                    case .failure(let failure): call.reject(failure.message, failure.code)
                    }
                }
            }
        }
    }
}
