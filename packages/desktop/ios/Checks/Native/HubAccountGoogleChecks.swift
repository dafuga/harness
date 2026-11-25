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
    bench.session.browserReturned(url, state: handoff)
    wait { (try? bench.status()?.get())?["state"] as? String == "signed-in" }
    check(bench.hub.body("/api/auth/native/exchange")["callbackCode"] as? String == code &&
          bench.hub.asked("/api/auth/native/poll").isEmpty && bench.vault.credential?.token == hubToken,
          "Google account: native flow exchanges callback code and PKCE once without polling")
    bench.session.browserReturned(url, state: handoff)
    _ = bench.status()
    check(bench.hub.asked("/api/auth/native/exchange").count == 1,
          "Google account: a replay does not exchange again")

    let cancelled = AccountBench()
    _ = cancelled.waiting(google: true)
    _ = cancelled.disconnect()
    cancelled.session.browserReturned(url, state: handoff)
    _ = cancelled.status()
    check(cancelled.hub.asked("/api/auth/native/exchange").isEmpty && cancelled.vault.credential == nil,
          "Google account: cancelling abandons the pending browser sign-in")
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
    guard let input = try? prepared?.get(), let account = input.account else {
        return check(false, "account computers: the native session prepares pairing")
    }
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
