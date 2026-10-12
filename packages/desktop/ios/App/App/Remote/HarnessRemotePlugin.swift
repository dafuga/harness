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
        CAPPluginMethod(name: "pair", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    private let session = RemoteSession()

    override public func load() {
        session.onStatus = { [weak self] status in self?.notifyListeners("status", data: status) }
        session.onEvent = { [weak self] event in self?.notifyListeners("event", data: event) }
        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(active), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(opened(_:)), name: .capacitorOpenURL, object: nil)
        session.start()
        #if DEBUG
        if let url = RemoteDebug.openURL { center.post(name: .capacitorOpenURL, object: ["url": url]) }
        #endif
    }

    @objc private func active() {
        session.resume()
    }

    /// The phone was opened with a `harnessremote://pair` link. Its text goes to the page, which
    /// asks for the code: a link holds public identifiers only. It is kept until the page listens.
    @objc private func opened(_ notification: Notification) {
        guard let object = notification.object as? [String: Any], let url = object["url"] as? URL,
            let link = RemotePolicy.pairingLink(url)
        else { return }
        notifyListeners("pairingLink", data: ["link": link], retainUntilConsumed: true)
    }

    @objc func status(_ call: CAPPluginCall) {
        session.status { call.resolve($0) }
    }

    @objc func pair(_ call: CAPPluginCall) {
        guard let origin = call.getString("origin"), let hostId = call.getString("hostId"),
            let pairingId = call.getString("pairingId"), let code = call.getString("code"),
            let deviceName = call.getString("deviceName")
        else { return call.reject(RemoteFailure.invalid.message, RemoteFailure.invalid.code) }
        let input = RemotePairing.Input(
            origin: origin, hostId: hostId, pairingId: pairingId, code: code, deviceName: deviceName)
        session.pair(input) { result in
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
