import Foundation

@available(iOS 17.0, macOS 14.0, *)
@MainActor
func enrollTranscriptChecks() async {
    do {
        let joining = AccountBench(), approving = AccountBench()
        joining.signIn()
        approving.signIn()
        let joinHub = try await EnrollHub.connected(joining.session)
        let adminHub = try await EnrollHub.connected(approving.session)
        let fixture = try EnrollTranscriptFixture(account: joinHub.account)
        fixture.install(on: joining.hub)
        fixture.install(on: approving.hub)

        let request = try EnrollRequest(device: SealedDevice.create(enclave: false))
        let mailbox = try await joinHub.open(request)
        let join = EnrollJoin(request: request, id: mailbox.id, hub: joinHub)
        let review = EnrollReview(id: mailbox.id, hub: adminHub, admin: fixture.admin)
        let claimed = try await review.claim()
        let left = try await join.compare()
        let right = try await review.compare()
        check(left?.code != nil && left?.code == right?.code, "native mailbox produces the same code on both sides")

        fixture.replaceClaim(EnrollClaim(approver: claimed.approver, nonce: Data(repeating: 1, count: 32)))
        await refusesChangedTranscript(join, review)
    } catch {
        check(false, "synthetic native mailbox round trip completes")
    }
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
private func refusesChangedTranscript(_ join: EnrollJoin, _ review: EnrollReview) async {
    do {
        _ = try await join.compare()
        check(false, "joining device refuses a changed claim after revealing")
    } catch {
        check(true, "joining device refuses a changed claim after revealing")
    }
    do {
        _ = try await review.compare()
        check(false, "approver refuses a changed claim after claiming")
    } catch {
        check(true, "approver refuses a changed claim after claiming")
    }
}

@available(iOS 17.0, macOS 14.0, *)
private final class EnrollTranscriptFixture {
    let admin: EnrollAdmin
    private let genesis: SealedChainEntry
    private let id = String(repeating: "a", count: 32)
    private var steps: [[String: Any]] = []

    init(account: String) throws {
        let device = try SealedDevice.create(enclave: false)
        let keys = try SealedScopeKeys(SealedRawScopeKeys.make())
        let member = SealedChainDevice(device, role: "admin", scopes: [keys.name])
        let root = try SealedJson.object([
            "type": .string("genesis"), "account": .string(account), "devices": .array([member.json]),
            "scopes": .array([SealedScopeCommitment(keys.raw).json])
        ])
        let entry = try device.sign(SealedChainEntry(seq: 0, prev: "", at: 1, body: root))
        genesis = entry
        admin = EnrollAdmin(device: device, state: try SealedChain.verify([entry], account: account),
                            keys: [keys.name: keys])
    }

    func install(on hub: FakeHub) {
        let path = "/api/sync/v1/enroll"
        hub.routes["GET /api/sync/v1/chain"] = { [self] _ in
            let answer = SealedJson.object(["entries": .array([genesis.json]), "more": .bool(false)])
            return HubAccountReply(status: 200, contentType: "application/json", data: Data(answer.canonical.utf8))
        }
        hub.routes["POST " + path] = { [self] request in
            _ = append(request)
            return mailbox(201)
        }
        hub.routes["GET " + path + "/" + id] = { [self] _ in mailbox(200) }
        hub.routes["POST " + path + "/" + id] = { [self] request in append(request) }
    }

    private func mailbox(_ status: Int) -> HubAccountReply {
        hubJSON(status, ["id": id, "steps": steps])
    }

    private func append(_ request: URLRequest) -> HubAccountReply {
        let step: [String: Any] = ["n": steps.count,
            "by": request.value(forHTTPHeaderField: "X-Harness-Device") ?? "",
            "body": String(decoding: request.httpBody ?? Data(), as: UTF8.self)]
        steps.append(step)
        return hubJSON(201, step)
    }

    func replaceClaim(_ claim: EnrollClaim) {
        let body = RemoteCoding.json(["approver": claim.approver, "nonce": RemoteCoding.base64url(claim.nonce)]) ?? Data()
        steps[1] = ["n": 1, "by": claim.approver, "body": String(decoding: body, as: UTF8.self)]
    }
}
