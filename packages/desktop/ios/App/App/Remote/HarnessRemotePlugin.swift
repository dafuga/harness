import Capacitor
import Foundation
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
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openVault", returnType: CAPPluginReturnPromise),
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
        if ["tracker_note", "tracker_flag", "tracker_answer", "tracker_discard_write"].contains(name) {
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
        let message = [confirmation.itemTitle, confirmation.question, intent.text].compactMap { $0 }.joined(separator: "\n\n")
        let title = confirmation.discard ? "Discard queued Tracker write" : "Queue Tracker " + intent.action
        let button = confirmation.discard ? "Discard" : "Queue " + intent.action
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [session] _ in
            call.resolve(session.trackerWriteReply(code: "cancelled"))
        })
        alert.addAction(UIAlertAction(title: button, style: confirmation.discard ? .destructive : .default) { [session] _ in
            session.confirmTrackerWrite(confirmation) { call.resolve($0) }
        })
        presenter.present(alert, animated: true)
    }

    @objc func refreshTracker(_ call: CAPPluginCall) {
        session.refreshTracker()
        call.resolve()
    }

    @objc func openVault(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, presenter.presentedViewController == nil,
                UIApplication.shared.applicationState == .active else { return call.reject("Vault is unavailable.") }
            let inbox = VaultInboxController(session: self.session)
            presenter.present(UINavigationController(rootViewController: inbox), animated: true)
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        session.status { call.resolve($0) }
    }

    /// Opens the camera for the QR code a computer shows and asks with the offer it reads. The
    /// page gives a name and nothing else: it hands over no offer and no address, and is handed
    /// none. Nothing connects here; the phone waits for a person to approve it on the computer.
    /// The session owns the scan: Disconnect ends it, and a camera that answers late asks nobody.
    @objc func scan(_ call: CAPPluginCall) {
        guard let name = RemoteScanFlow.name(call.getString("deviceName")) else {
            return call.reject(RemoteFailure.invalid.message, RemoteFailure.invalid.code)
        }
        let scanner = RemoteCameraScanner(presenter: { [weak self] in self?.bridge?.viewController })
        session.scan(scanner, deviceName: name) { result in
            switch result {
            case .success(let status): call.resolve(status)
            case .failure(let failure): call.reject(failure.message, failure.code)
            }
        }
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
