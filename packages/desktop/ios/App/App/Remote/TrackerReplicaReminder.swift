import Foundation

struct TrackerReplicaReminder: Codable {
    let at: String
    let repeats: String?
    /// "work" or "personal". Older Macs send only personal reminders and omit these three.
    var group: String? = nil
    var due: String? = nil
    var allDay: Bool? = nil

    var valid: Bool {
        TrackerReplicaItem.short(at, 40) && TrackerReplicaItem.short(repeats ?? "", 20)
            && (group.map { ["work", "personal"].contains($0) } ?? true)
            && TrackerReplicaItem.short(due ?? "", 40)
    }
}
