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
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    private let session = RemoteSession()

    override public func load() {
        session.onStatus = { [weak self] status in self?.notifyListeners("status", data: status) }
        session.onEvent = { [weak self] event in self?.notifyListeners("event", data: event) }
        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(active), name: UIApplication.didBecomeActiveNotification, object: nil)
        session.start()
    }

    @objc private func active() {
        session.resume()
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
