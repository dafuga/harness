import CryptoKit
import Foundation

func accountGoogleChecks() {
    let bench = AccountBench()
    let pending = try? bench.waiting(google: true)?.get()
    let handoff = bench.opened.first?.lastPathComponent ?? ""
    let code = String(repeating: "b", count: 43)
    let url = URL(string: "harness-account://callback/sign-in?state=\(handoff)&code=\(code)")!
    check(pending?["state"] as? String == "pending" && !handoff.isEmpty,
          "Google account: the system browser opens the Hub sign-in for the current device")
    check(bench.hub.body("/api/auth/native/start")["callback"] as? String == "ios",
          "Google account: the S256 challenge is bound to the iOS callback")
    check(HubAccountSession.browserCode(url, state: "other") == nil,
          "Google account: an unrelated callback is refused")
    let signer = P256.Signing.PrivateKey()
    bench.session.makeLoginDevice = {
        SealedDevice(deviceId: RemoteCoding.base64url(RemoteCoding.random(16)),
                     kem: .software(P256.KeyAgreement.PrivateKey()), signing: .software(signer))
    }
    let devicePath = "/api/sync/v1/device-session"
    bench.hub.routes["GET " + devicePath] = { _ in hubJSON(200, ["state": "waiting-for-approval"]) }
    setupEnrollmentMailbox(bench)
    bench.session.browserReturned(url, state: handoff)
    wait { bench.vault.credential != nil }
    let stage = try? bench.status()?.get()
    check(stage?["state"] as? String == "waiting-for-approval" && stage?["actor"] == nil,
          "Google account: a new device waits after the native return")
    verifyEnrollmentOpening(bench, signer: signer)
    let reads = bench.hub.asked("/api/projects").count
    check(bench.request("/api/projects")?.refusal != nil && bench.hub.asked("/api/projects").count == reads,
          "Google account: a waiting device cannot read projects")
    check(awaited(bench.session.computers)?.refusal != nil && bench.hub.asked("/api/remote/hosts").isEmpty,
          "Google account: a waiting device cannot discover or pair computers")
    verifyLoginComparison(bench)
    verifyDeniedEnrollment()
    macEnrollmentChecks()
    approvedDeviceReply(bench, path: devicePath, signer: signer)
    wait { (try? bench.status()?.get())?["state"] as? String == "signed-in" }
    check(bench.hub.asked(devicePath).contains { $0.httpMethod == "POST" } &&
          bench.hub.bearer(devicePath) == "Bearer " + hubToken,
          "Google account: an approved installation signs the challenge inside the native session")
    check(bench.hub.body("/api/auth/native/exchange")["callbackCode"] as? String == code &&
          bench.hub.asked("/api/auth/native/poll").isEmpty && bench.vault.credential?.token == hubToken,
          "Google account: native flow exchanges callback code and PKCE once without polling")
    bench.session.browserReturned(url, state: handoff)
    _ = bench.status()
    check(bench.hub.asked("/api/auth/native/exchange").count == 1,
          "Google account: a replay does not exchange again")
    nativeSignOutHistory(bench)

    let cancelled = AccountBench()
    _ = cancelled.waiting(google: true)
    _ = cancelled.disconnect()
    cancelled.session.browserReturned(url, state: handoff)
    _ = cancelled.status()
    check(cancelled.hub.asked("/api/auth/native/exchange").isEmpty && cancelled.vault.credential == nil,
          "Google account: cancelling abandons the pending browser sign-in")
}

private func nativeSignOutHistory(_ bench: AccountBench) {
    do {
        guard let credential = bench.vault.credential else { throw HubAccountFailure.signedOut }
        let keys = try HubLoginDeviceStore(credential, base: bench.session.loginKeys)
        let pins = try HubLoginDeviceStore(credential, base: bench.session.loginPins)
        let remembered = pins.load(HubLoginAdmission.pinName)
        let hadInstallation = keys.load(SealedDeviceStore.name) != nil
        _ = bench.disconnect()
        check(hadInstallation && remembered != nil && pins.load(HubLoginAdmission.pinName) == remembered &&
              keys.load(SealedDeviceStore.name) == nil, "grants: sign-out preserves the verified head and erases the installation key")
    } catch { check(false, "grants: a signed-in fixture supplies the original installation and history") }
}

private func approvedDeviceReply(_ bench: AccountBench, path: String, signer: P256.Signing.PrivateKey) {
    let challenge = RemoteCoding.base64url(Data(repeating: 9, count: 32))
    bench.hub.routes["GET " + path] = { _ in hubJSON(200, ["state": "proof-required", "challenge": challenge]) }
    bench.hub.routes["POST " + path] = { request in
        let body = request.httpBody.flatMap(RemoteCoding.object)
        let signature = (body?["signature"] as? String).flatMap(RemoteCoding.data(base64url:))
        let signed = signature.flatMap { try? P256.Signing.ECDSASignature(rawRepresentation: $0) }
        let message = Data(("harness/sealed/v1/session\0" + challenge).utf8)
        let accepted = request.value(forHTTPHeaderField: "X-Harness-Device") != nil
            && body?["challenge"] as? String == challenge && signed.map { signer.publicKey.isValidSignature($0, for: message) } == true
        return accepted ? hubJSON(200, ["state": "approved"]) : hubJSON(403, ["error": "device-proof-denied"])
    }
}

func accountComputerChecks() {
    let bench = AccountBench()
    let computersPath = "/api/remote/hosts"
    let host = P256.KeyAgreement.PrivateKey().publicKey.x963Representation
    let hostId = RemoteCoding.identity(of: host)
    let path = "\(computersPath)/\(hostId)/pairing"
    let signedOut = awaited(bench.session.computers)
    check(signedOut?.refusal == .signedOut && bench.hub.seen.isEmpty,
          "account computers: discovery requires a session")
    bench.signIn()
    let row: [String: Any] = ["hostId": hostId, "name": "Fixture Mac", "online": true, "hostKey": "private field"]
    bench.hub.routes["GET \(computersPath)"] = { _ in hubJSON(200, ["computers": [row]]) }
    let listed = (try? awaited(bench.session.computers)?.get())?.first
    check(listed?["name"] as? String == "Fixture Mac" && listed?.count == 3,
          "account computers: bridge only returns computer display fields")
    check(bench.request(path)?.refusal == .refused && bench.hub.asked(path).isEmpty,
          "account computers: generic bridge cannot access the pairing endpoint")
    let hostKey = RemoteCoding.base64url(host)
    bench.hub.routes["GET \(path)"] = { _ in
        hubJSON(200, ["hostId": hostId, "hostKey": hostKey, "origin": "https://relay.example.invalid"])
    }
    bench.hub.routes["POST \(path)"] = { _ in hubJSON(202, ["state": "requested"]) }
    let prepared: Result<RemotePairing.Input, HubAccountFailure>? =
        awaited { bench.session.computerPairing(hostId, name: "iPhone", done: $0) }
    guard let input = try? prepared?.get() else {
        return check(false, "account computers: the native session prepares pairing")
    }
    let account = input.account
    check(input.code.isEmpty && account.subject == bench.session.credential?.subject,
          "account computers: the connection is bound to the signed-in subject and takes no code")
    accountComputerRequest(bench, input: input, account: account, path: path)
}

private func accountComputerRequest(
    _ bench: AccountBench, input: RemotePairing.Input, account: RemotePairing.Account, path: String
) {
    var material = RemotePairingMaterial()
    guard let sealed = material.request(input, info: ["hostKey": account.hostKey, "state": "open"]) else {
        return check(false, "account computers: native material seals the pairing")
    }
    let outcome: Result<Void, RemoteFailure>? = awaited { account.request(sealed, $0) }
    let posted = bench.hub.body(path)
    let challenge = RemoteCoding.base64url(RemoteCoding.sha256(Data(material.verifier.utf8)))
    check(outcome?.refusal == nil && posted["pairingId"] as? String == input.pairingId &&
          posted["challenge"] as? String == challenge && Set(posted.keys) == ["pairingId", "ephemeralKey", "sealed", "challenge"],
          "account computers: the Hub receives only the native sealed request and PKCE challenge")
    let requests = bench.hub.asked(path)
    check(requests.count == 2 && requests.allSatisfy {
        $0.url?.query == nil && $0.url?.fragment == nil && $0.value(forHTTPHeaderField: "Authorization") == "Bearer " + hubToken
    }, "account computers: both requests authenticate in a header without URL credentials")
    _ = bench.disconnect()
    let after: Result<Void, RemoteFailure>? = awaited { account.request(sealed, $0) }
    check(after?.refusal != nil && bench.hub.asked(path).count == requests.count,
          "account computers: a pairing from a signed-out session cannot send again")
}

private let enrollPath = "/api/sync/v1/enroll"

private func setupEnrollmentMailbox(_ bench: AccountBench, denied: Bool = false) {
    var response: HubAccountReply?
    bench.hub.routes["GET " + enrollPath + "/" + String(repeating: "a", count: 32)] = { _ in response ?? hubJSON(404, [:]) }
    bench.hub.routes["POST " + enrollPath] = { request in
        guard let data = request.httpBody, let body = String(data: data, encoding: .utf8),
            let by = request.value(forHTTPHeaderField: "X-Harness-Device")
        else { return hubJSON(400, [:]) }
        var value: [String: Any] = ["id": String(repeating: "a", count: 32),
            "createdAt": Int(bench.time.timeIntervalSince1970 * 1000),
            "steps": [["n": 0, "by": by, "body": body]]]
        if denied { value["denied"] = true }
        response = hubJSON(200, value)
        return hubJSON(201, value)
    }
}

private func verifyEnrollmentOpening(_ bench: AccountBench, signer: P256.Signing.PrivateKey) {
    _ = bench.status()
    let openings = bench.hub.asked(enrollPath).filter { $0.httpMethod == "POST" }
    let fields = bench.hub.body(enrollPath)
    let restarted = AccountBench(vault: bench.vault)
    restarted.time = bench.time
    restarted.hub.routes["GET /api/sync/v1/device-session"] = { _ in hubJSON(200, ["state": "waiting-for-approval"]) }
    setupEnrollmentMailbox(restarted)
    let resumed = try? restarted.status()?.get()
    let sameOpening = restarted.hub.body(enrollPath)["commit"] as? String == fields["commit"] as? String
    check(resumed?["state"] as? String == "waiting-for-approval" && sameOpening &&
          openings.count == 1 && Set(fields.keys) == ["kemPublic", "signingPublic", "commit", "platform"] &&
          fields["platform"] as? String == "iphone" &&
          fields["signingPublic"] as? String == RemoteCoding.base64url(signer.publicKey.x963Representation) &&
          (fields["commit"] as? String)?.count == 64 && bench.hub.bearer(enrollPath) == "Bearer " + hubToken,
          "Google account: waiting opens one account-bound mailbox for this phone's keys")
}

private func verifyDeniedEnrollment() {
    let bench = AccountBench()
    setupEnrollmentMailbox(bench, denied: true)
    bench.hub.routes["GET /api/sync/v1/device-session"] = { _ in hubJSON(200, ["state": "waiting-for-approval"]) }
    bench.signIn()
    let result = bench.status()
    check(result?.refusal?.code == "approval-denied" &&
          bench.request("/api/projects")?.refusal != nil && bench.hub.asked("/api/projects").isEmpty,
          "Google account: denial closes the request while the phone stays locked")
}

private func macEnrollmentChecks() {
    let bench = AccountBench()
    bench.session.enrollmentPlatform = .mac
    bench.hub.routes["GET /api/sync/v1/device-session"] = { _ in hubJSON(200, ["state": "waiting-for-approval"]) }
    setupEnrollmentMailbox(bench)
    bench.signIn()
    let stage = try? bench.status()?.get()
    check(stage?["state"] as? String == "waiting-for-approval" && stage?["actor"] == nil &&
          bench.hub.body("/api/sync/v1/enroll")["platform"] as? String == "mac",
          "Mac account: the real admission flow waits with a Mac enrollment label")
}
