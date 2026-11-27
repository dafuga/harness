import SwiftUI

@available(iOS 17.0, *)
extension VaultRootView {
    func pollWhileActive(_ connection: BrokerConnection) async {
        var delay = 3
        while !Task.isCancelled {
            notifications.retryRegistrationIfNeeded()
            let target = requestToOpen
            let fresh = await model.poll(connection, includeReleaseAlerts: !connection.hasRemoteAlerts)
            guard !Task.isCancelled else { return }
            let openedFromNotification = resolveNotification(target, at: connection)
            if alertsEnabled, fresh, !openedFromNotification {
                await notifications.notify()
            }
            await synchronizePush(at: connection)
            delay = connection.pollState.hasFailure ? min(delay * 2, 30) : 3
            do {
                try await Task.sleep(for: .seconds(delay))
            } catch {
                return
            }
        }
    }

    private func synchronizePush(at connection: BrokerConnection) async {
        #if VAULT_APNS
        guard let registration = notifications.registration,
              registration != connection.pushRegistration,
              model.isCurrent(connection), connection.pollState == .ready,
              ContinuousClock.now >= connection.retryPushAfter else { return }
        do {
            try await connection.configuration.client().updatePushSubscription(
                deviceToken: registration.token, sign: model.signer(for: connection)
            )
            connection.pushRegistration = registration
            connection.retryPushAfter = .now
        } catch {
            connection.retryPushAfter = .now.advanced(by: .seconds(30))
        }
        #endif
    }
}
