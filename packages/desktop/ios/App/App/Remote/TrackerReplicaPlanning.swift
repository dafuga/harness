import Foundation

struct TrackerReplicaPlanning: Codable {
    struct Artifact: Codable {
        struct Link: Codable {
            let label: String
            let url: String
            let kind: String?
        }

        struct Page: Codable {
            let name: String
            let states: [String: String]?
            let links: [Link]?
        }

        let summary: String?
        let pages: [Page]?
        let links: [Link]?
    }

    struct Promotion: Codable {
        let stage: String
        let by: String
        let at: String
    }

    let artifacts: [String: Artifact]
    let promotions: [Promotion]
}
