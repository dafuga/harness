import Capacitor
import UIKit

/// The one web view of the app: the same bundled renderer as the desktop, with the plugin that
/// connects this phone to a computer and the one that holds its own Hub account.
class HarnessViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HarnessRemotePlugin())
        bridge?.registerPluginInstance(HarnessAccountPlugin())
    }
}
