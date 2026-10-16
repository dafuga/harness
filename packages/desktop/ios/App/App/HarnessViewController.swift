import Capacitor
import UIKit

/// The one web view of the app: the same renderer as the desktop, with the plugin that connects
/// this phone to a computer.
class HarnessViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HarnessRemotePlugin())
    }
}
