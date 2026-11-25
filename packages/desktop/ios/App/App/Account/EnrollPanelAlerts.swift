#if canImport(UIKit)
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
#endif
