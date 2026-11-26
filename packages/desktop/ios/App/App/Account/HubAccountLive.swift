import Foundation

/// The upgrade of the account's live socket. The session travels in its header only, as on every
/// other call of this phone, and the socket is signed here so that it never leaves this side.
extension HubAccountSession {
    private static let liveCall = HubAccountCall(method: "GET", path: "/api/sync/v1/live")
    private static let syncDeviceKey = "harness.sync.device"

    /// Nil while this phone has no session: there is then nothing to follow.
    func liveRequest(device: String, done: @escaping (URLRequest?) -> Void) {
        queue.async {
            guard let origin = self.origin, let credential = self.live() else { return done(nil) }
            done(Self.liveRequest(origin, token: credential.token, device: device))
        }
    }

    static func liveRequest(_ origin: URL, token: String, device: String) -> URLRequest? {
        guard var request = HubAccountPolicy.request(origin, liveCall, token: token), let address = request.url,
            var parts = URLComponents(url: address, resolvingAgainstBaseURL: false)
        else { return nil }
        parts.scheme = "wss"
        request.url = parts.url
        request.setValue(device, forHTTPHeaderField: "X-Harness-Device")
        return request
    }

    /// This install's opaque sync id: 16 random bytes. It names no person and opens nothing.
    static func syncDevice(_ defaults: UserDefaults = .standard) -> String {
        if let kept = defaults.string(forKey: syncDeviceKey),
            HubAccountPolicy.matches(kept, "\\A[A-Za-z0-9_-]{22}\\z") { return kept }
        let fresh = RemoteCoding.base64url(RemoteCoding.random(16))
        defaults.set(fresh, forKey: syncDeviceKey)
        return fresh
    }
}
