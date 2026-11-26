import UIKit
import UserNotifications

@available(iOS 17.0, *)
extension VaultNotifications: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse
    ) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier,
              let target = BrokerPushTarget(userInfo: response.notification.request.content.userInfo) else { return }
        await MainActor.run { tappedRequest = target }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
