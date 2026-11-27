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

    /// The `tracker_document` input: an item and one of its attachments.
    static func request(_ input: [String: Any]) throws -> (id: String, attachment: String) {
        guard input.keys.sorted() == ["attachment", "id"], let id = input["id"] as? String,
            let attachment = input["attachment"] as? String,
            TrackerReplicaItem.short(id, 80), TrackerReplicaItem.short(attachment, 64)
        else { throw TrackerReplicaError.invalidInput }
        return (id, attachment)
    }

    static func reply(_ id: String, of flag: TrackerReplicaItem.Flag?) throws -> [String: Any] {
        guard let content = flag?.attachments?.first(where: { $0.id == id })?.content
        else { throw TrackerReplicaError.noMatch }
        return ["document": try TrackerReplicaJSON.object(content)]
    }

    /// What the assistant reads about an item lists its documents without their text.
    static func listing(_ flag: TrackerReplicaItem.Flag) -> TrackerReplicaItem.Flag {
        var listed = flag
        listed.attachments = flag.attachments.map { entries in
            entries.map { entry -> TrackerReplicaAttachment in
                var plain = entry
                plain.content = nil
                return plain
            }
        }
        return listed
    }
}
