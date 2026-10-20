import Foundation

/// The only failure the plugin reports to the page: a code of the protocol and display words.
struct RemoteFailure: Error {
    let code: String
    let message: String

    static let offline = RemoteFailure(code: "offline", message: "The computer is not connected.")
    static let deadline = RemoteFailure(code: "deadline", message: "The computer did not answer in time.")
    static let denied = RemoteFailure(
        code: "method-denied", message: "This operation is not available on this connection.")
    static let invalid = RemoteFailure(code: "invalid-message", message: "The request was not understood.")
    static let tooLarge = RemoteFailure(code: "too-large", message: "The message is too large.")
    static let tooMany = RemoteFailure(code: "too-many-requests", message: "Too many requests are waiting.")
    /// A change whose answer never came: this side cannot know whether the computer ran it.
    static let uncertain = RemoteFailure(
        code: "offline",
        message: "The computer was lost before it confirmed this change. Check the project before trying again.")
    /// The grant or the approval changed while a read waited: its answer is no longer wanted.
    static let superseded = RemoteFailure(
        code: "failed", message: "The permissions of this phone changed. Reload and try again.")
    /// Answers by which the computer itself says this phone may not do what it asked.
    static let denials: Set<String> = ["project-denied", "agents-denied", "method-denied", "not-attached"]
    static func failed(_ message: String) -> RemoteFailure {
        RemoteFailure(code: "failed", message: message)
    }
}

/// An answer of the computer, or the copy the phone kept of one with the time it was saved.
struct RemoteAnswer {
    let value: Any
    let cachedAt: String?
}

/// Bounds of backend-contract.md section 2.6, in the units this side uses.
enum RemoteLimits {
    static let frameBytes = 262_144
    static let chunkBytes = 131_072
    static let requestBytes = 65_536
    static let messageBytes = 16_777_216
    static let pendingRequests = 32
    static let requestSeconds = 30.0
    static let mutationSeconds = 120.0
    static let handshakeSeconds = 10.0
    static let pingSeconds = 25.0
    static let pollSeconds = 2.0
    static let pairingSeconds = 300.0
    /// The most raw bytes of one recorded artifact: a larger one is neither kept nor served.
    static let artifactBytes = 11 * 1024 * 1024
}

/// What a phone may ask of a computer at most. Folders and hosted sign-in stay on the computer;
/// what a session really offers is what the computer attached, within these.
enum RemoteMethods {
    static let reads: Set<String> = [
        "listProjects", "capabilities", "snapshot", "entity", "history", "source", "image", "evidence",
        "artifact", "messages", "pendingComments", "providers"
    ]
    static let changes: Set<String> = [
        "addComment", "createPlan", "openThread", "approve", "startRun", "cancelRun"
    ]
    static func allowed(_ method: String) -> Bool {
        reads.contains(method) || changes.contains(method)
    }
}

struct RemoteProject: Codable {
    let id: String
    let name: String
}

struct RemoteGrant: Codable {
    var projects: [RemoteProject]
    var agents: Bool
    var comments: Bool?

    init?(_ value: Any?) {
        guard let object = value as? [String: Any], let agents = object["agents"] as? Bool,
            let list = object["projects"] as? [[String: Any]]
        else { return nil }
        self.comments = object["comments"] as? Bool
        self.agents = agents && self.comments != false
        self.projects = list.compactMap { item in
            guard let id = item["id"] as? String, let name = item["name"] as? String else { return nil }
            return RemoteProject(id: id, name: name)
        }
    }

    var object: [String: Any] {
        var value: [String: Any] = ["projects": projects.map { ["id": $0.id, "name": $0.name] }, "agents": agents]
        if let comments = comments { value["comments"] = comments }
        return value
    }
}

/// One pairing, kept whole in the Keychain: the credential and the device key never leave it.
/// `methods` is what the computer allowed when it last attached this phone; none before that.
struct RemoteRecord: Codable {
    var origin: String
    var hostId: String
    var hostKey: String
    var hostName: String
    var deviceId: String
    var deviceName: String
    var deviceSecret: String
    var credential: String
    var generation: Int
    var grant: RemoteGrant
    var lastOnlineAt: String?
    var epoch: String?
    var sequence: Int
    var methods: [String]?
}
