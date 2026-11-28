import AuthenticationServices
import Capacitor
import Foundation
import LocalAuthentication
import UIKit
import UserNotifications

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
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deviceApproval", returnType: CAPPluginReturnPromise)
    ]

    static let sharedSession: HubAccountSession = {
        let session = HubAccountSession(origin: hubOrigin)
        session.accountEnded = HarnessAccountPlugin.accountEnded
        HarnessAccountPlugin.registerApprovalAlerts(session)
        return session
    }()

    private static var hubOrigin: URL? {
        HubAccountPolicy.origin(Bundle.main.object(forInfoDictionaryKey: HubAccountPolicy.infoKey))
    }

    static func storedSubject() -> String? {
        sharedSession.queue.sync {
            guard sharedSession.deviceStage == .approved else { return nil }
            return sharedSession.live()?.subject
        }
    }

    private var session: HubAccountSession { Self.sharedSession }
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

extension HarnessAccountPlugin {
    private static let approvalAlertID = "harness-device-approval"

    private static func accountEnded() {
        TrackerRefresh.session.endAccount()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [approvalAlertID])
        center.removeDeliveredNotifications(withIdentifiers: [approvalAlertID])
    }

    private static func registerApprovalAlerts(_ session: HubAccountSession) {
        session.approvalAlert = { [weak session] in
            guard let session else { return }
            let generation = session.generation
            Task { @MainActor in
                await showApprovalAlert {
                    session.queue.sync {
                        session.generation == generation && session.deviceStage == .approved && session.live() != nil
                    }
                }
            }
        }
    }

    @MainActor
    private static func showApprovalAlert(_ current: () -> Bool) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard current() else { return }
        let authorized: Bool
        if settings.authorizationStatus == .notDetermined, UIApplication.shared.applicationState == .active {
            authorized = (try? await center.requestAuthorization(options: [.alert, .sound])) == true
        } else {
            authorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        }
        guard authorized, current() else { return }
        let content = UNMutableNotificationContent()
        content.title = "Harness"
        content.body = "A device sign-in is ready for review."
        content.sound = .default
        try? await center.add(UNNotificationRequest(identifier: approvalAlertID, content: content, trigger: nil))
    }

    /// The web view can review public approval details. Credentials and key wrapping stay here.
    @objc func deviceApproval(_ call: CAPPluginCall) {
        let done: HubAccountSession.Status = { Self.settle(call, $0) }
        if call.getString("action") == "list" { return session.approvalRequests(done) }
        guard let id = call.getString("id") else { return done(.failure(.refused)) }
        switch call.getString("action") {
        case "review": session.reviewApproval(id, done: done)
        case "deny": session.denyDevice(id, done: done)
        case "approve":
            guard let code = call.getString("code") else { return done(.failure(.refused)) }
            session.approveDevice(id, code: code, authenticate: Self.confirmDevice, done: done)
        default: done(.failure(.refused))
        }
    }

    private static func confirmDevice(_ done: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            let context = LAContext()
            context.touchIDAuthenticationAllowableReuseDuration = 0
            context.localizedFallbackTitle = ""
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                   localizedReason: "Approve the device with the matching code.") { accepted, _ in
                context.invalidate()
                done(accepted)
            }
        }
    }
}
