import Foundation

/// Why a link to the computer ended.
enum RemoteLinkClosure {
    case revoked
    case hostOffline
    case lost
}

protocol RemoteLinkDelegate: AnyObject {
    /// The computer accepted the handshake under this generation of the device's approval.
    func linkReady(_ link: RemoteLink, generation: Int)
    func link(_ link: RemoteLink, received message: Data)
    func link(_ link: RemoteLink, closed closure: RemoteLinkClosure)
}

/// The secure path to a computer as a session uses it. The app's is `RemoteChannel`; a check
/// hands in its own, so that the rules of a session are proven without a network.
protocol RemoteLink: AnyObject {
    var delegate: RemoteLinkDelegate? { get set }
    func open()
    func close()
    /// False when nothing could be sent.
    func send(_ message: Data) -> Bool
}
