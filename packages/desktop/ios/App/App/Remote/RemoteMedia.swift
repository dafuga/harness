import Foundation

/// The integrity of media a computer sent (backend-contract.md section 2.4).
enum RemoteMedia {
    /// True for anything that is not media. Media is kept and shown only when its bytes are
    /// exactly what it states, and when that is the hash that was asked for.
    static func verified(_ method: String, _ input: [String: Any], _ value: Any) -> Bool {
        guard method == "image" else { return true }
        guard let media = value as? [String: Any], media["encoding"] as? String == "base64",
            let bytes = (media["data"] as? String).flatMap({ Data(base64Encoded: $0) }),
            let hash = media["sha256"] as? String, bytes.count == media["byteLength"] as? Int,
            RemoteCoding.hex(RemoteCoding.sha256(bytes)) == hash
        else { return false }
        let asked = input["sha256"] as? String
        return asked == nil || asked == hash
    }
}
