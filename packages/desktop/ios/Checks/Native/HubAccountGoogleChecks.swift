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
