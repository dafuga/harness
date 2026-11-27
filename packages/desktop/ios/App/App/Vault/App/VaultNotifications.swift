import Observation
import SwiftUI
import UIKit
import UserNotifications

enum PushRegistration: Equatable {
    case disabled
    case enabled(Data)

    var token: Data? {
        if case .enabled(let token) = self { return token }
        return nil
    }
}

@available(iOS 17.0, *)
@Observable
final class VaultNotifications: NSObject {
    static let shared = VaultNotifications()
    var tappedRequest: BrokerPushTarget?
    private(set) var registration: PushRegistration?
    private var wantsRemoteAlerts = false
    private var retryRegistrationAfter: ContinuousClock.Instant?

    func refreshRegistration(enabled: Bool) async -> Bool {
        let granted = enabled
            ? (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) == true
            : false
        guard !Task.isCancelled else { return granted }
        #if VAULT_APNS
        wantsRemoteAlerts = granted
        retryRegistrationAfter = nil
        if wantsRemoteAlerts {
            if registration == .disabled { registration = nil }
            UIApplication.shared.registerForRemoteNotifications()
        } else {
            registration = .disabled
        }
        #endif
        return granted
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        guard wantsRemoteAlerts else { return }
        retryRegistrationAfter = nil
        registration = .enabled(token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        if wantsRemoteAlerts { retryRegistrationAfter = .now.advanced(by: .seconds(30)) }
    }

    func retryRegistrationIfNeeded() {
        guard wantsRemoteAlerts, let retryRegistrationAfter,
              ContinuousClock.now >= retryRegistrationAfter else { return }
        self.retryRegistrationAfter = nil
        UIApplication.shared.registerForRemoteNotifications()
    }

    func notify() async {
        let content = UNMutableNotificationContent()
        content.title = "Harness Vault"
        content.body = "A request is ready for review."
        content.sound = .default
        try? await UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: "pending-review", content: content, trigger: nil)
        )
    }
}
