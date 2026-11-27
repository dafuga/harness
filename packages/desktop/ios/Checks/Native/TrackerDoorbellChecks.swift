import Foundation

private func connectionChecks() {
    let bench = DoorbellBench()
    bench.run { bench.bell.start() }
    check(bench.count == 1 && !bench.live, "doorbell: it is not live before the socket opens")
    bench.say(.opened)
    check(bench.live && bench.heard == 1, "doorbell: opening is live and rings once to catch up")
    bench.notice("home")
    check(bench.heard == 2, "doorbell: a home notice rings")
    bench.notice("chat")
    bench.say(.message("{\"t\":\"enroll\",\"id\":\"x\",\"n\":0}"))
    bench.say(.message("pong"))
    check(bench.heard == 2, "doorbell: chat, sign-in and pong say nothing about the tracker")
    bench.say(.message("{\"t\":\"poke\",\"scope\":\"s\",\"seq\":1,\"kind\":\"objects\"}"))
    check(bench.heard == 3, "doorbell: a sealed poke rings")

    let first = bench.socket!
    bench.say(.closed)
    check(!bench.live && first.closed, "doorbell: a closed socket is not live")
    check(wait { bench.count == 2 }, "doorbell: a lost socket is reopened")
    bench.say(.opened, on: first)
    check(!bench.live && bench.heard == 3, "doorbell: a late word of the old socket changes nothing")
    bench.say(.opened)
    check(bench.live && bench.heard == 4, "doorbell: every reconnect rings, so a gap hides no change")

    bench.run { bench.bell.stop() }
    check(!bench.live && bench.socket!.closed, "doorbell: stopping closes the socket")
    Thread.sleep(forTimeInterval: 0.1)
    check(bench.count == 2, "doorbell: a stopped doorbell opens nothing more")
}

private func silenceChecks() {
    let timing = TrackerDoorbellTiming(ping: 0.05, retry: 0.02, maxRetry: 0.05)
    let quiet = DoorbellBench(timing: timing)
    quiet.run { quiet.bell.start() }
    check(wait { quiet.count >= 2 }, "doorbell: a socket that never opens is replaced")
    quiet.say(.opened)
    let open = quiet.socket!
    check(wait { quiet.queue.sync { open.sent.contains("ping") } }, "doorbell: an open socket is pinged")
    check(wait { quiet.queue.sync { open.closed } }, "doorbell: a half-open socket that answers nothing is dropped")
    quiet.run { quiet.bell.stop() }

    let signedOut = DoorbellBench()
    signedOut.signedIn = false
    signedOut.run { signedOut.bell.start() }
    check(wait { signedOut.queue.sync { signedOut.asked >= 3 } } && signedOut.count == 0,
          "doorbell: without a session it opens no socket and asks again later")
    signedOut.queue.sync { signedOut.signedIn = true }
    check(wait { signedOut.count == 1 }, "doorbell: signing in is followed without a restart")
    signedOut.run { signedOut.bell.stop() }
}

private func upgradeChecks() {
    let origin = URL(string: "https://hub.example.invalid")!
    let device = String(repeating: "A", count: 22)
    let request = HubAccountSession.liveRequest(origin, token: "fixture-token", device: device)
    check(request?.url?.absoluteString == "wss://hub.example.invalid/api/sync/v1/live",
          "doorbell: the upgrade address is the Hub's live route and holds no credential")
    check(request?.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-token"
          && request?.value(forHTTPHeaderField: "X-Harness-Device") == device,
          "doorbell: the session and device travel in headers")
    let name = "harness-doorbell-check-\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: name)!
    defer { defaults.removePersistentDomain(forName: name) }
    let kept = HubAccountSession.syncDevice(defaults)
    check(HubAccountPolicy.matches(kept, "\\A[A-Za-z0-9_-]{22}\\z") && HubAccountSession.syncDevice(defaults) == kept,
          "doorbell: this install keeps one opaque device id")
}

func trackerDoorbellChecks() {
    connectionChecks()
    silenceChecks()
    upgradeChecks()
}
