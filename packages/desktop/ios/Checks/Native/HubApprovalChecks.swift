import Foundation

private let requestsPath = "/api/sync/v1/enroll"
private let changesPath = "/api/sync/v1/devices"
private let approvalPushPath = "/api/sync/v1/approval-apns"
private let approvalID = String(repeating: "a", count: 32)

func hubApprovalChecks() {
    guard #available(iOS 17.0, macOS 14.0, *) else { return }
    let bench = AccountBench()
    let pushToken = prepareApprovalPush(bench)
    var alerts = 0
    bench.session.approvalAlert = { alerts += 1 }
    let listed = try? awaited(bench.session.approvalRequests)?.get()
    check(listed == nil && bench.hub.asked(requestsPath).isEmpty && alerts == 0,
          "approval: a signed-out phone cannot read the inbox or receive a notification")
    bench.signIn()
    verifyApprovalPush(bench, token: pushToken)
    do {
        let device = try SealedDevice.create(enclave: false)
        let join = try EnrollRequest(device: device)
        let mailbox = ApprovalMailbox(bench: bench, join: join)
        mailbox.install()
        let list = try awaited(bench.session.approvalRequests)?.get()
        let rows = list?["requests"] as? [[String: Any]]
        check(rows?.count == 1 && rows?.first?["id"] as? String == approvalID &&
            rows?.first?["platform"] as? String == "mac" && rows?.first?["country"] as? String == "PT" &&
            rows?.first?["steps"] == nil, "approval: the admitted phone receives only safe inbox display fields")
        _ = try awaited(bench.session.approvalRequests)?.get()
        check(alerts == 1, "approval: repeated reads of a pending request notify once")
        try checkApprovalReview(bench, mailbox: mailbox)
    } catch { check(false, "approval: native inbox and review complete") }
}

private func prepareApprovalPush(_ bench: AccountBench) -> Data {
    let token = Data(repeating: 0x4b, count: 32)
    bench.hub.routes["GET " + approvalPushPath] = { _ in hubJSON(200, ["available": true]) }
    bench.hub.routes["POST " + approvalPushPath] = { _ in hubJSON(200, ["subscribed": true]) }
    bench.session.approvalPush.request = { [weak session = bench.session] _ in
        session?.receiveApprovalPushToken(token)
    }
    return token
}

private func verifyApprovalPush(_ bench: AccountBench, token: Data) {
    _ = awaited(bench.session.status)
    bench.session.queue.sync {}
    let posts = bench.hub.asked(approvalPushPath).filter { $0.httpMethod == "POST" }
    let fields = posts.first?.httpBody.flatMap(RemoteCoding.object)
    check(posts.count == 1 && fields?["token"] as? String == String(repeating: "4b", count: token.count) &&
        posts.first?.value(forHTTPHeaderField: "X-Harness-Device") != nil &&
        posts.first?.value(forHTTPHeaderField: "Authorization") != nil,
          "approval: native push token is registered once in the body after device admission")
}

@available(iOS 17.0, macOS 14.0, *)
private func checkApprovalReview(_ bench: AccountBench, mailbox: ApprovalMailbox) throws {
    let first = try awaited { bench.session.reviewApproval(approvalID, done: $0) }?.get()
    check(first?["state"] as? String == "waiting" && mailbox.claim != nil && bench.hub.asked(changesPath).isEmpty,
          "approval: review claims the opening and waits for the joining device to reveal")
    mailbox.revealed = true
    let review = try awaited { bench.session.reviewApproval(approvalID, done: $0) }?.get()
    let expected = try mailbox.code()
    check(review?["code"] as? String == expected, "approval: the native approver computes the same comparison code as the joining device")
    let decline = awaited { bench.session.approveDevice(approvalID, code: expected, authenticate: { $0(false) }, done: $0) }
    check(decline?.refusal != nil && bench.hub.asked(changesPath).isEmpty, "approval: declining local authentication cannot publish any grant")
    let wrong = awaited { bench.session.approveDevice(approvalID, code: "mismatch", authenticate: { $0(true) }, done: $0) }
    check(wrong?.refusal != nil && bench.hub.asked(changesPath).isEmpty, "approval: a different comparison code cannot publish")
    let success = try awaited { bench.session.approveDevice(approvalID, code: expected, authenticate: { $0(true) }, done: $0) }?.get()
    try mailbox.checkPublished(success)
}

private final class ApprovalMailbox {
    let bench: AccountBench
    let join: EnrollRequest
    let path = requestsPath + "/" + approvalID
    var claim: [String: String]?
    var revealed = false

    init(bench: AccountBench, join: EnrollRequest) { self.bench = bench; self.join = join }

    func install() {
        bench.hub.routes["GET " + requestsPath] = { [self] _ in
            hubJSON(200, ["requests": [["id": approvalID, "createdAt": Int64(bench.time.timeIntervalSince1970 * 1000),
                "display": ["platform": "mac", "country": "PT"], "steps": [step(0, join.device.deviceId, join.opening.fields)]]]])
        }
        bench.hub.routes["GET " + path] = { [self] _ in hubJSON(200, ["id": approvalID, "steps": steps()]) }
        bench.hub.routes["POST " + path] = { [self] request in
            let fields = request.httpBody.flatMap(RemoteCoding.object) as? [String: String] ?? [:]
            let by = request.value(forHTTPHeaderField: "X-Harness-Device") ?? ""
            if fields["entryHash"] != nil { return hubJSON(201, step(3, by, fields)) }
            claim = fields
            return hubJSON(201, step(1, by, fields))
        }
        bench.hub.routes["POST " + changesPath] = { request in
            do {
                let (_, entry, _) = try Self.publication(request)
                return hubJSON(201, ["seq": entry.seq, "hash": entry.hash])
            } catch { return hubJSON(400, [:]) }
        }
    }

    func code() throws -> String {
        let (device, _) = try approver()
        guard let nonce = claim?["nonce"].flatMap(RemoteCoding.data(base64url:))
        else { throw HubAccountFailure.failed }
        return try join.code(claim: EnrollClaim(approver: device.deviceId, nonce: nonce),
                             approverSigningPublic: device.signingPublic)
    }

    @available(iOS 17.0, macOS 14.0, *)
    func checkPublished(_ response: [String: Any]?) throws {
        guard let request = bench.hub.asked(changesPath).last else { throw HubAccountFailure.failed }
        let (mailbox, entry, grant) = try Self.publication(request)
        let (approver, credential) = try approver()
        guard let data = bench.vault.firstDeviceReplies[approver.deviceId]?["chain"]?.data,
            let genesis = try SealedJson.parse(data)["entries"]?.items?.first else { throw HubAccountFailure.failed }
        let chain = try SealedChain.verify([try SealedChainEntry(json: genesis), entry], account: credential.subject)
        let recipient = try chain.openGrant(grant, as: join.device)
        check(response?["state"] as? String == "approved" && mailbox == approvalID &&
            chain.devices[join.device.deviceId]?.active == true && recipient.name == grant.scope &&
            bench.hub.body(path)["entryHash"] as? String == entry.hash,
            "approval: atomic publication signs the recipient into the chain, wraps its key and writes a receipt")
    }

    private func approver() throws -> (SealedDevice, HubAccountCredential) {
        guard let credential = bench.vault.credential,
            let kept = try SealedDeviceStore.load(from: HubLoginDeviceStore(credential, base: bench.session.loginKeys))
        else { throw HubAccountFailure.failed }
        return (kept, credential)
    }

    private func steps() -> [[String: Any]] {
        var result = [step(0, join.device.deviceId, join.opening.fields)]
        if let claim, let by = claim["approver"] { result.append(step(1, by, claim)) }
        if revealed { result.append(step(2, join.device.deviceId, ["nonce": RemoteCoding.base64url(join.nonce)])) }
        return result
    }

    private func step(_ n: Int, _ by: String, _ fields: [String: String]) -> [String: Any] {
        ["n": n, "by": by, "body": String(decoding: RemoteCoding.json(fields) ?? Data(), as: UTF8.self)]
    }

    private static func publication(_ request: URLRequest) throws -> (String, SealedChainEntry, SealedGrant) {
        let json = try SealedJson.parse(request.httpBody ?? Data())
        guard let mailbox = json["enrollment"]?.text, let entry = json["entries"]?.items?.first,
            let grant = json["grants"]?.items?.first else { throw HubAccountFailure.failed }
        return try (mailbox, SealedChainEntry(json: entry), SealedGrant(enrollmentJson: grant))
    }
}
