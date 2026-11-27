import SwiftUI

@available(iOS 17.0, *)
extension VaultRootView {
    func openNotification(_ target: BrokerPushTarget) {
        tab = .requests
        requestToOpen = nil
        guard let connection = model.connections.first(where: {
            $0.configuration.role == .approver && target.matches(origin: $0.configuration.origin)
        }) else { return }
        requestToOpen = target
        connection.retryPoll()
    }

    func resolveNotification(_ target: BrokerPushTarget?, at connection: BrokerConnection) -> Bool {
        guard let target, target == requestToOpen, connection.pollState == .ready,
              model.isCurrent(connection), target.matches(origin: connection.configuration.origin) else { return false }
        requestToOpen = nil
        if let request = connection.requests.first(where: { $0.id == target.requestID && connection.live($0) }) {
            notificationReview = InboxItem(connection: connection, kind: .release(request))
        } else {
            model.error = "This request is no longer pending."
        }
        return true
    }
}
