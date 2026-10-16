import Foundation

#if DEBUG
/// Simulator and check fixtures only. This type does not exist in a Release build, so nothing
/// there can turn a local relay on.
enum RemoteDebug {
    static var loopback = ProcessInfo.processInfo.arguments.contains("-HarnessRemoteLoopback")
}
#endif

/// Which relays this phone asks at all.
enum RemotePolicy {
    private static func local(_ host: String) -> Bool {
        ["localhost", "::1", "0.0.0.0"].contains(host) || host.hasPrefix("127.")
    }

    /// A relay is an exact https origin of another machine: no path, no user information, and
    /// no fallback to this device. A Debug build may opt in to plain http on this machine.
    static func origin(_ text: String) -> URL? {
        guard let url = URL(string: text), let scheme = url.scheme, let host = url.host, !host.isEmpty,
            url.path.isEmpty, url.query == nil, url.fragment == nil, url.user == nil, url.password == nil
        else { return nil }
        if scheme == "https" && !local(host) { return url }
        #if DEBUG
        if RemoteDebug.loopback && scheme == "http" && local(host) { return url }
        #endif
        return nil
    }

    /// Where a device opens its socket. The credential travels in a header, never here.
    static func socket(_ origin: URL, hostId: String) -> URL? {
        var parts = URLComponents(url: origin, resolvingAgainstBaseURL: false)
        parts?.scheme = origin.scheme == "https" ? "wss" : "ws"
        parts?.path = "/v1/hosts/\(hostId)/connect"
        return parts?.url
    }

    /// The kinds of relay whose offers this build asks with: those on the internet, and, in a
    /// Debug build that was started for a local fixture, the one on this machine.
    static var environments: [String] {
        #if DEBUG
        if RemoteDebug.loopback { return ["production", "local"] }
        #endif
        return ["production"]
    }
}
