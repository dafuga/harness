import Capacitor
import UIKit

/// The one web view of the app: the same bundled renderer as the desktop, with the plugin that
/// connects this phone to a computer, the one that holds its own Hub account, and the native Vault.
class HarnessViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HarnessRemotePlugin())
        bridge?.registerPluginInstance(HarnessAccountPlugin())
        bridge?.registerPluginInstance(HarnessVaultPlugin())
    }

    #if DEBUG && targetEnvironment(simulator)
    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // UI checks open the Vault over synthetic requests without driving the web view.
        guard #available(iOS 17.0, *), presentedViewController == nil,
              ProcessInfo.processInfo.arguments.contains("--vault-ui-test") else { return }
        HarnessVaultPlugin.present(on: self)
    }
    #endif
}
