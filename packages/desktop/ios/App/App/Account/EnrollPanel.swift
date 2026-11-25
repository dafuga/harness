#if canImport(UIKit)
import UIKit

@available(iOS 17.0, *)
@MainActor
final class EnrollPanel {
    private weak var owner: UIViewController?
    private let session: HubAccountSession

    init(owner: UIViewController, session: HubAccountSession) {
        self.owner = owner
        self.session = session
    }

    func show() async throws {
        let hub = try await EnrollHub.connected(session)
        let storage = EnrollStorage(origin: hub.origin, account: hub.account)
        if let pin = try storage.pin(), let device = try storage.device() {
            let admin = try await hub.admin(device, pin: pin)
            try await storage.publishName(hub, device: device.deviceId, keys: admin.keys)
            return try await manage(hub, admin: admin)
        }
        let alert = prompt("Approve this device on your iPhone or Mac",
                           "Start a request, then open Devices on an enrolled device.")
        action("Request approval", in: alert) {
            let device = try storage.joiningDevice()
            let request = try EnrollRequest(device: device)
            let mailbox = try await hub.open(request)
            let join = EnrollJoin(request: request, id: mailbox.id, hub: hub)
            try await self.check(join)
        }
        present(alert)
    }

    func present(_ alert: UIAlertController) {
        guard let owner, owner.viewIfLoaded?.window != nil else { return }
        if let shown = owner.presentedViewController, shown.isBeingDismissed,
            let transition = shown.transitionCoordinator {
            transition.animate(alongsideTransition: nil) { _ in owner.present(alert, animated: true) }
        } else if owner.presentedViewController == nil {
            owner.present(alert, animated: true)
        }
    }

    private func check(_ join: EnrollJoin) async throws {
        guard let comparison = try await join.compare() else {
            let alert = prompt("Waiting for approval", "Open Devices on an enrolled device.")
            action("Check for code", in: alert) { try await self.check(join) }
            return present(alert)
        }
        compare(join, code: comparison.code)
    }

    private func compare(_ join: EnrollJoin, code: String) {
        let alert = prompt(code, "Check that the same six digits appear on your enrolled device.")
        action("Check approval", in: alert) {
            if try await join.complete(name: "Harness " + UIDevice.current.model) != nil {
                self.present(self.prompt("Device approved"))
            } else {
                self.compare(join, code: code)
            }
        }
        present(alert)
    }

    private func manage(_ hub: EnrollHub, admin: EnrollAdmin) async throws {
        let device = admin.device.deviceId
        let requests = try await hub.pending(as: device).filter { try $0.claim() == nil }
        let alert = prompt("Devices", requests.isEmpty ? "No devices are waiting for approval." : nil)
        for request in requests {
            let id = try request.opening().deviceId
            action("Review " + id, in: alert) {
                let review = EnrollReview(id: request.id, hub: hub, admin: admin)
                _ = try await review.claim()
                try await self.check(review)
            }
        }
        let others = admin.state.devices.values.filter {
            $0.active && $0.deviceId != device && $0.role != "recovery"
        }
        if !others.isEmpty {
            action("Revoke a device", in: alert) { self.revocations(hub, admin: admin, devices: others) }
        }
        action("Refresh", in: alert) { try await self.show() }
        present(alert)
    }

    private func check(_ review: EnrollReview) async throws {
        guard let approval = try await review.compare() else {
            let alert = prompt("Waiting for the new device", "On the new device, select Check for code.")
            action("Check for code", in: alert) { try await self.check(review) }
            return present(alert)
        }
        let alert = prompt(approval.code, "Approve only if the code matches the new device.")
        action("Approve device", in: alert) {
            if try await review.approve(approval) != nil { self.present(self.prompt("Device approved")) }
        }
        present(alert)
    }

    private func revocations(_ hub: EnrollHub, admin: EnrollAdmin, devices: [SealedChainDevice]) {
        let alert = prompt("Revoke a device", "Select the device to remove and confirm with biometrics.")
        for device in devices.sorted(by: { $0.deviceId < $1.deviceId }) {
            action(device.deviceId, in: alert, style: .destructive) {
                if try await hub.revoke(device.deviceId, admin: admin) != nil {
                    self.present(self.prompt("Device revoked"))
                }
            }
        }
        present(alert)
    }
}
#endif
