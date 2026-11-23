import AuthenticationServices
import Capacitor
import Foundation
import UIKit

/// The page's way to this phone's own Hub account, beside and apart from any paired computer.
/// The page is told a public status and the answers of project reads; the origin, the verifier,
/// the nonce and the session stay in HubAccountSession, and nothing of them is logged or handed
/// over. A build without `HarnessHubOrigin` says it is not configured and asks nobody.
@objc(HarnessAccountPlugin)
public class HarnessAccountPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
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

    private var authentication: ASWebAuthenticationSession?
    private var authenticationState: String?

    /// Google sign-in uses the Hub in the system authentication session.
    override public func load() {
        session.open = { page in DispatchQueue.main.async { UIApplication.shared.open(page) } }
        session.deviceName = "Harness " + UIDevice.current.model
        session.authenticate = { [weak self] page, state in
            DispatchQueue.main.async { self?.authenticate(page, state: state) }
        }
        session.cancelAuthentication = { [weak self] in
            DispatchQueue.main.async { self?.authentication?.cancel() }
        }
    }

    private func authenticate(_ page: URL, state: String) {
        let callback: (URL?, Error?) -> Void = { [weak self] url, _ in
            DispatchQueue.main.async {
                guard let self = self, self.authenticationState == state else { return }
                self.authenticationState = nil
                self.authentication = nil
                self.session.browserReturned(url, state: state)
            }
        }
        let flow: ASWebAuthenticationSession
        if #available(iOS 17.4, *) {
            flow = ASWebAuthenticationSession(url: page, callback: .customScheme(HubAccountSession.googleScheme),
                completionHandler: callback)
        } else {
            flow = ASWebAuthenticationSession(url: page, callbackURLScheme: HubAccountSession.googleScheme,
                completionHandler: callback)
        }
        authenticationState = state
        authentication = flow
        flow.presentationContextProvider = self
        if !flow.start() { callback(nil, nil) }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    @objc func status(_ call: CAPPluginCall) {
        session.status { HarnessAccountPlugin.settle(call, $0) }
    }

    @objc func connect(_ call: CAPPluginCall) {
        let settle: HubAccountSession.Status = { HarnessAccountPlugin.settle(call, $0) }
        if call.getBool("google") == true { session.connectGoogle(settle) }
        else { session.connect(settle) }
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
