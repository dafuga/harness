import Capacitor
import SwiftUI
import UIKit
import UserNotifications

/// Opens the native Vault. It takes no arguments and returns nothing about requests or entries.
@objc(HarnessVaultPlugin)
class HarnessVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "HarnessVaultPlugin"
    let jsName = "HarnessVault"
    let pluginMethods = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard #available(iOS 17.0, *) else { return call.reject("Vault needs iOS 17 or later.") }
            guard let host = self.bridge?.viewController, host.presentedViewController == nil else {
                return call.reject("Vault is already open.")
            }
            HarnessVaultPlugin.present(on: host)
            call.resolve()
        }
    }

    @available(iOS 17.0, *)
    @MainActor
    static func present(on host: UIViewController) {
        UNUserNotificationCenter.current().delegate = VaultNotifications.shared
        let screen = UIHostingController(rootView: AnyView(EmptyView()))
        screen.rootView = AnyView(VaultRootView(notifications: .shared) { [weak screen] in
            screen?.dismiss(animated: true)
        })
        screen.modalPresentationStyle = .fullScreen
        host.present(screen, animated: true)
    }
}
