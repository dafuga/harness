import Foundation

// TEST ONLY. Measures the phone's live chain on this Mac. Real: the Hub's Home and live routes and
// the relay's account object in local workerd (started by scripts/measure-ios-tracker-live.ts),
// the app's socket, doorbell, session and SQLite replica. Stood in: the paired computer, which
// answers each pull at once, so no relay round trip to a Mac and no real network is measured.

let hub = URL(string: CommandLine.arguments[1])!
let token = CommandLine.arguments[2]
let samples = 30

/// The upgrade the app signs, pointed at the loopback fixture, which serves plain ws.
func loopbackUpgrade() -> URLRequest {
    var secure = URLComponents(url: hub, resolvingAgainstBaseURL: false)!
    secure.scheme = "https"
    var request = HubAccountSession.liveRequest(
        secure.url!, token: token, device: String(repeating: "A", count: 22))!
    var address = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
    address.scheme = "ws"
    request.url = address.url
    return request
}

/// What the Mac's publisher does after a tracker change; the Hub then rings the account.
func publish() {
    var request = URLRequest(url: hub.appendingPathComponent("api/hub-home"))
    request.httpMethod = "PUT"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = Data("""
    {"overview":{"status":"unavailable"},"agents":[],"plans":[],"scheduled":[],
    "providers":{"routines":null,"routinesReadAt":null,"quota":null}}
    """.utf8)
    URLSession.shared.dataTask(with: request) { _, response, _ in
        if (response as? HTTPURLResponse)?.statusCode != 200 { print("FAIL publish was refused") }
    }.resume()
}

/// A paired phone whose computer holds one tracker change per `version` and answers every pull.
final class LivePhone {
    let root = temporary("tracker-live-measure")
    let bench: Bench
    private var answered = 0
    private var version = 0
    private var cursor = 0
    private var changes: [Date] = []
    var state = "reconnecting"

    init() {
        bench = Bench(trackerRoot: root)
        bench.session.onTrackerChange = { [weak self] event in
            self?.state = event["state"] as? String ?? "?"
            if event["changed"] as? Bool == true { self?.changes.append(Date()) }
        }
    }

    var told: Int { bench.session.queue.sync { changes.count } }
    var lastTold: Date { bench.session.queue.sync { changes.last! } }
    var shown: String { bench.session.queue.sync { state } }

    func change() { version += 1 }

    /// Answers the pulls that are waiting, with the change the computer holds if it is new.
    func serve() {
        let asked = bench.link.asked("trackerReplicaPull")
        guard asked.count > answered else { return }
        answered = asked.count
        let before = cursor
        var rows: [[String: Any]] = []
        if version > 0 && version != before {
            rows = [["id": "fixture001", "row": trackerItemFixture("fixture001", "Version \(version)")]]
            cursor = version
        }
        bench.answer(bench.link, "trackerReplicaPull", value: [
            "kind": "delta", "requestCursor": "seq-\(before)", "cursor": "seq-\(cursor)",
            "hubTime": "2026-11-23T12:00:00.000Z", "partial": true, "hasMore": false, "operations": rows
        ])
    }

    func serve(until condition: () -> Bool) -> Bool {
        wait(8) {
            serve()
            return condition()
        }
    }

    func pair() {
        bench.start()
        bench.attach(Bench.Answer(methods: Bench.methods + ["trackerReplicaPull"]))
        bench.answer(bench.link, "trackerReplicaPull", value: trackerSnapshotFixture(
            [trackerItemFixture("fixture001")], cursor: "seq-0"))
        answered = 1
    }
}

let phone = LivePhone()
defer { try? FileManager.default.removeItem(at: phone.root) }
phone.pair()
var sockets: [TrackerDoorbellChannel] = []
phone.bench.session.useTrackerDoorbell(TrackerDoorbell(queue: phone.bench.session.queue) { done in
    let channel = TrackerDoorbellChannel(loopbackUpgrade())
    sockets.append(channel)
    done(channel)
})
check(phone.serve { phone.shown == "live" }, "the app's socket opens against the real account object")
_ = wait(1) { phone.serve(); return false }

var times: [Double] = []
for _ in 1...samples {
    let before = phone.told
    phone.change()
    let started = Date()
    publish()
    guard phone.serve(until: { phone.told > before }) else { break }
    times.append(phone.lastTold.timeIntervalSince(started) * 1000)
    _ = wait(0.05) { phone.serve(); return false }
}
times.sort()
check(times.count == samples, "every publish reached the page event")
if !times.isEmpty {
    let at = { (share: Double) in Int(times[Int((Double(times.count) * share).rounded(.up)) - 1].rounded()) }
    print("phone publish-to-page-event ms {\"samples\":\(times.count),\"p50\":\(at(0.5)),\"p95\":\(at(0.95)),\"max\":\(at(1))}")
    check(at(0.95) < 1000, "p95 from publish to page event is under one second")
}

// The socket is cut under the doorbell, and a change is published before it is reopened.
let opened = sockets.count
let missed = phone.told
phone.change()
let cut = Date()
phone.bench.session.queue.sync { sockets.last!.close() }
publish()
check(phone.serve { phone.shown == "reconnecting" }, "a cut socket says reconnecting")
check(phone.serve { phone.told > missed && phone.shown == "live" }, "a reconnect catches up on what was missed")
check(sockets.count > opened, "the reconnect opened a new socket")
if phone.told > missed {
    print("phone cut-to-caught-up ms \(Int(phone.lastTold.timeIntervalSince(cut) * 1000))")
}
phone.bench.session.setTrackerForeground(false)

print("Live chain: \(passes) passed, \(failures) failed.")
exit(failures == 0 ? 0 : 1)
