import Foundation

/// Mailbox contents are untrusted until bound to a verified chain and comparison transcript.
struct EnrollMailbox {
    struct Step {
        let by: String
        let fields: SealedJson

        init(_ json: SealedJson, position: Int) throws {
            guard let by = json["by"]?.text, let body = json["body"]?.text,
                json["n"]?.number == Int64(position)
            else { throw HubAccountFailure.failed }
            self.by = by
            fields = try SealedJson.parse(Data(body.utf8))
        }

        func bytes(_ field: String) throws -> Data {
            guard let value = fields[field]?.text, let bytes = RemoteCoding.data(base64url: value),
                RemoteCoding.base64url(bytes) == value else { throw HubAccountFailure.failed }
            return bytes
        }
    }

    let id: String
    private let steps: [Step]

    init(_ json: SealedJson) throws {
        guard let id = json["id"]?.text, EnrollHub.Route.enrollment(id).valid,
            let values = json["steps"]?.items, (1...8).contains(values.count)
        else { throw HubAccountFailure.failed }
        self.id = id
        steps = try values.enumerated().map { try Step($0.element, position: $0.offset) }
    }

    func opening() throws -> EnrollOpening {
        let first = steps[0]
        guard let commit = first.fields["commit"]?.text else { throw HubAccountFailure.failed }
        let keys = try SealedEnrollKeys(kemPublic: first.bytes("kemPublic"),
                                       signingPublic: first.bytes("signingPublic"))
        return EnrollOpening(deviceId: first.by, keys: keys, commit: commit)
    }

    func claim() throws -> EnrollClaim? {
        guard steps.count > 1 else { return nil }
        let second = steps[1]
        guard second.by != steps[0].by, second.fields["approver"]?.text == second.by
        else { throw HubAccountFailure.failed }
        return try EnrollClaim(approver: second.by, nonce: second.bytes("nonce"))
    }

    func reveal() throws -> Data? {
        guard steps.count > 2 else { return nil }
        guard steps[2].by == steps[0].by else { throw HubAccountFailure.failed }
        return try steps[2].bytes("nonce")
    }

    func approval(by approver: String) throws -> String? {
        guard steps.count > 3 else { return nil }
        guard steps[3].by == approver, let hash = steps[3].fields["entryHash"]?.text,
            HubAccountPolicy.matches(hash, "\\A[0-9a-f]{64}\\z")
        else { throw HubAccountFailure.failed }
        return hash
    }
}

extension EnrollHub {
    func open(_ request: EnrollRequest) async throws -> EnrollMailbox {
        let device = request.device.deviceId
        let history = try await entries(as: device)
        guard !history.isEmpty else {
            throw HubAccountFailure(code: "no-enrolled-admin", message: "No enrolled admin can approve this device yet.")
        }
        _ = try SealedChain.verify(history, account: account)
        let reply = try await send(.pending, as: device, method: "POST",
                                   body: RemoteCoding.json(request.opening.fields))
        let mailbox = try EnrollMailbox(response(reply, status: 201))
        guard try mailbox.opening() == request.opening else { throw HubAccountFailure.failed }
        return mailbox
    }

    func mailbox(_ id: String, as device: String) async throws -> EnrollMailbox {
        let reply = try await send(.enrollment(id), as: device)
        let mailbox = try EnrollMailbox(response(reply, status: 200))
        guard mailbox.id == id else { throw HubAccountFailure.failed }
        return mailbox
    }

    func pending(as device: String) async throws -> [EnrollMailbox] {
        let answer = try await send(.pending, as: device)
        guard let requests = try response(answer, status: 200)["requests"]?.items else {
            throw HubAccountFailure.failed
        }
        return requests.compactMap { try? EnrollMailbox($0) }
    }

    func append(_ fields: [String: String], to id: String, as device: String) async throws {
        let reply = try await send(.enrollment(id), as: device, method: "POST", body: RemoteCoding.json(fields))
        _ = try response(reply, status: 201)
    }
}
