#if canImport(UIKit)
import Capacitor
import UIKit

@available(iOS 17.0, *)
extension EnrollPanel {
    func prompt(_ title: String, _ message: String? = nil) -> UIAlertController {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Close", style: .cancel))
        return alert
    }

    func action(
        _ title: String, in alert: UIAlertController, style: UIAlertAction.Style = .default,
        perform: @escaping @MainActor () async throws -> Void
    ) {
        alert.addAction(UIAlertAction(title: title, style: style) { _ in
            Task { @MainActor in
                do { try await perform() }
                catch {
                    let message = (error as? HubAccountFailure)?.message ?? "Refresh and try again."
                    self.present(self.prompt("Devices", message))
                }
            }
        })
    }
}
extension HarnessAccountPlugin {
    @objc func sealedDevices(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 17.0, *), let owner = bridge?.viewController else {
                return call.reject("Device approval requires iOS 17 or later.")
            }
            let panel = EnrollPanel(owner: owner, session: Self.sharedSession)
            do {
                try await panel.show()
                call.resolve()
            } catch {
                call.reject((error as? HubAccountFailure)?.message ?? "Could not open Devices.")
            }
        }
    }

}
#endif
