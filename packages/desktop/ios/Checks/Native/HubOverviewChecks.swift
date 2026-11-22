import Foundation

// The tracker overview of the Hub account, checked on the real `HubAccountPolicy` and
// `HubAccountSession`. `AccountBench` and `hubToken` are the ones of HubAccountChecks.swift.

/// The overview is one plain GET: no query, no body, no alias and no other method is admitted.
func overviewPolicyChecks() {
    let overview = HubAccountCall(method: "GET", path: "/api/tracker-overview")
    let overviewRefused = [HubAccountCall(method: "GET", path: "/api/tracker-overview", query: ["x": "1"]),
        HubAccountCall(method: "GET", path: "/api/tracker-overview", body: Data("{}".utf8)), HubAccountCall(method: "PUT", path: "/api/tracker-overview"),
        HubAccountCall(method: "POST", path: "/api/tracker-overview"), HubAccountCall(method: "DELETE", path: "/api/tracker-overview"),
        HubAccountCall(method: "GET", path: "/api/tracker-overview/"), HubAccountCall(method: "GET", path: "/api//tracker-overview"),
        HubAccountCall(method: "GET", path: "/api/tracker-overview?x=1"), HubAccountCall(method: "GET", path: "/API/TRACKER-OVERVIEW"),
        HubAccountCall(method: "GET", path: "/api/tracker-overview%2F")]
    check(HubAccountPolicy.allowed(overview) && overviewRefused.allSatisfy { !HubAccountPolicy.allowed($0) }, "account: the tracker overview is one plain GET; queries, bodies, other methods and aliases are refused")
}

/// The overview is signed with the kept session, refused aliases and methods are never sent, and
/// after Disconnect it is not sent again.
func overviewRequestChecks() {
    let bench = AccountBench()
    bench.signIn()
    bench.hub.routes["GET /api/tracker-overview"] = { _ in HubAccountReply(status: 200, contentType: "application/json", data: Data("{}".utf8)) }
    let overview = (try? bench.request("/api/tracker-overview")?.get())?.object ?? [:]
    check(overview["data"] as? String == "e30=" && bench.hub.bearer("/api/tracker-overview") == "Bearer \(hubToken)", "account: the tracker overview is signed with the kept session and answered without it")
    let sent = bench.hub.seen.count
    let aliased = ["/api/tracker-overview?x=1", "/api/tracker-overview/", "/api/tracker-overview?"]
    check(aliased.allSatisfy { bench.request($0)?.refusal == .refused } && bench.request("/api/tracker-overview", "POST")?.refusal == .refused && bench.hub.seen.count == sent, "account: the tracker overview refuses queries, aliases and other methods without sending them")
    _ = bench.disconnect()
    check(bench.request("/api/tracker-overview")?.refusal == .signedOut && bench.hub.asked("/api/tracker-overview").count == 1, "account: after Disconnect the tracker overview is not sent and no earlier answer is kept")
}
