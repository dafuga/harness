import Foundation

/// The integrity of media a computer sent (backend-contract.md section 2.4): a design image, or
/// an artifact of recorded runtime evidence.
enum RemoteMedia {
    /// What a recorded artifact may be, by the one name a computer serves each as: a screenshot,
    /// recorded sound, data or plain text. Markup and anything a browser would run are not in it.
    static let artifactTypes: Set<String> = [
        "image/png", "image/jpeg", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "application/json",
        "text/plain; charset=utf-8"
    ]

    /// True for anything that is not media. Media is kept and shown only when its bytes are
    /// exactly what it states, and when that is the hash that was asked for. An artifact also
    /// has to be asked by its hash, be of a safe kind and stay inside its size.
    static func verified(_ method: String, _ input: [String: Any], _ value: Any) -> Bool {
        guard method == "image" || method == "artifact" else { return true }
        guard let media = value as? [String: Any] else { return false }
        let asked = input["sha256"] as? String
        if method == "artifact" { return asked != nil && admitted(media) && intact(media) == asked }
        guard let hash = intact(media) else { return false }
        return asked == nil || asked == hash
    }

    /// The hash media states, when its bytes are exactly what it states; nil otherwise.
    private static func intact(_ media: [String: Any]) -> String? {
        guard media["encoding"] as? String == "base64",
            let bytes = (media["data"] as? String).flatMap({ Data(base64Encoded: $0) }),
            let hash = media["sha256"] as? String, bytes.count == media["byteLength"] as? Int,
            RemoteCoding.hex(RemoteCoding.sha256(bytes)) == hash
        else { return nil }
        return hash
    }

    /// An artifact is decoded only when it names a safe kind and states a size inside the limit.
    private static func admitted(_ media: [String: Any]) -> Bool {
        guard let kind = media["mediaType"] as? String, let length = media["byteLength"] as? Int else { return false }
        return artifactTypes.contains(kind) && length <= RemoteLimits.artifactBytes
    }
}
