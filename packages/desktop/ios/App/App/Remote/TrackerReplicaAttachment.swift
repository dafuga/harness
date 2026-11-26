import Foundation

/// One document attached to an ask. The text travels with the flag while it fits, so it opens offline.
struct TrackerReplicaAttachment: Codable {
    struct Content: Codable {
        let markdown: String
        var images: [String: String]? = nil
    }

    let id: String
    let kind: String
    let title: String
    var repo: String? = nil
    var pr: Int? = nil
    var path: String? = nil
    var ref: String? = nil
    var url: String? = nil
    let bytes: Int
    var content: Content? = nil

    var valid: Bool {
        let short = TrackerReplicaItem.short
        guard short(id, 64), ["spec", "doc", "design"].contains(kind), short(title, 640) else { return false }
        guard short(repo ?? "", 140), short(path ?? "", 1200), short(ref ?? "", 64), short(url ?? "", 400)
        else { return false }
        guard let content else { return true }
        let images = content.images?.reduce(0) { $0 + $1.key.utf8.count + $1.value.utf8.count } ?? 0
        return content.markdown.utf8.count + images <= 64 * 1024
    }
}
