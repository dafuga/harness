import Capacitor
import Foundation
import UIKit

/// The page's way to this phone's own Hub account, beside and apart from any paired computer.
/// The page is told a public status and the answers of project reads; the origin, the verifier,
/// the nonce and the session stay in HubAccountSession, and nothing of them is logged or handed
/// over. A build without `HarnessHubOrigin` says it is not configured and asks nobody.
@objc(HarnessAccountPlugin)
public class HarnessAccountPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HarnessAccountPlugin"
    public let jsName = "HarnessAccount"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    private let session = HubAccountSession(
        origin: HubAccountPolicy.origin(Bundle.main.object(forInfoDictionaryKey: HubAccountPolicy.infoKey)))

    /// Google sign-in happens in the system browser, on the Hub's own approval page.
    override public func load() {
        session.open = { page in DispatchQueue.main.async { UIApplication.shared.open(page) } }
    }

    @objc func status(_ call: CAPPluginCall) {
        session.status { HarnessAccountPlugin.settle(call, $0) }
    }

    @objc func connect(_ call: CAPPluginCall) {
        session.connect { HarnessAccountPlugin.settle(call, $0) }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        session.disconnect { HarnessAccountPlugin.settle(call, $0) }
    }

    /// One call of the project API, `{ method, path, query?, body? }`, answered with
    /// `{ status, contentType, data }`. The page names no origin and holds no credential.
    @objc func request(_ call: CAPPluginCall) {
        guard let input = HubAccountCall(call.options) else {
            return call.reject(HubAccountFailure.refused.message, HubAccountFailure.refused.code)
        }
        session.request(input) { result in
            switch result {
            case .success(let reply): call.resolve(reply.object)
            case .failure(let failure): call.reject(failure.message, failure.code)
            }
        }
    }

    private static func settle(_ call: CAPPluginCall, _ result: Result<[String: Any], HubAccountFailure>) {
        switch result {
        case .success(let status): call.resolve(status)
        case .failure(let failure): call.reject(failure.message, failure.code)
        }
    }
}
