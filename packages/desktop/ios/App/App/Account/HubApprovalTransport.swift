import Foundation

/// Native-only transport for the approved installation. Exposes no general-purpose sync route.
struct HubApprovalTransport {
    static let inbox = "/api/sync/v1/enroll"
    static let limit = 16
    let ledger: HubLoginLedger
    let admitted: EnrolledDevice

    static func validID(_ id: String) -> Bool {
        HubAccountPolicy.matches(id, "\\A[0-9a-f]{32}\\z")
    }

    func requests(_ done: @escaping HubAccountSession.Status) {
        send(Self.inbox) { result in
            do {
                guard let items = try result.get()["requests"]?.items, items.count <= Self.limit
                else { throw HubAccountFailure.failed }
                done(.success(["requests": try items.map(Self.display)]))
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    private static func display(_ json: SealedJson) throws -> [String: Any] {
        guard let id = json["id"]?.text, validID(id),
            let createdAt = json["createdAt"]?.number, createdAt >= 0
        else { throw HubAccountFailure.failed }
        var display: [String: Any] = ["id": id, "createdAt": createdAt]
        let hint = json["display"]
        if let platform = hint?["platform"]?.text, ["iphone", "mac", "web"].contains(platform) {
            display["platform"] = platform
        }
        if let country = hint?["country"]?.text, HubAccountPolicy.matches(country, "\\A[A-Z]{2}\\z"), country != "XX" {
            display["country"] = country
        }
        return display
    }

    func mailbox(_ id: String, _ done: @escaping (Result<EnrollMailbox, HubAccountFailure>) -> Void) {
        send(Self.inbox + "/" + id) { result in
            do {
                let json = try result.get()
                if json["denied"] == .bool(true) { throw HubAccountFailure.approvalDenied }
                let mailbox = try EnrollMailbox(json)
                guard mailbox.id == id else { throw HubAccountFailure.failed }
                done(.success(mailbox))
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    func append(_ id: String, fields: [String: String], at position: Int, _ done: @escaping (Result<SealedJson, HubAccountFailure>) -> Void) {
        send(Self.inbox + "/" + id, body: RemoteCoding.json(fields)) { result in
            do {
                let json = try result.get()
                let step = try EnrollMailbox.Step(json, position: position)
                let expected = SealedJson.object(fields.mapValues(SealedJson.string))
                guard step.by == ledger.device.deviceId, step.fields == expected else { throw HubAccountFailure.failed }
                done(.success(json))
            } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
        }
    }

    func send(_ path: String, body: Data? = nil, _ done: @escaping (Result<SealedJson, HubAccountFailure>) -> Void) {
        let call = HubAccountCall(method: body == nil ? "GET" : "POST", path: path, body: body)
        do {
            try ledger.send(call) { result in
                do {
                    let reply = try result.get()
                    guard (200...201).contains(reply.status) else { throw HubAccountFailure.hub(reply) }
                    done(.success(try SealedJson.parse(reply.data)))
                } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
            }
        } catch { done(.failure(error as? HubAccountFailure ?? .failed)) }
    }
}
