import Foundation

@MainActor
func enrollTransportChecks() async {
    let bench = AccountBench()
    bench.signIn()
    let chain = "/api/sync/v1/chain"
    bench.hub.routes["GET " + chain] = { _ in hubJSON(200, ["entries": [], "more": false]) }
    let device = RemoteCoding.base64url(Data(repeating: 9, count: 16))
    do {
        let hub = try await EnrollHub.connected(bench.session)
        let reply = try await hub.send(.chain(-1), as: device)
        let sent = bench.hub.asked(chain).last
        check(reply.status == 200 && sent?.url?.query == "after=-1" &&
            sent?.value(forHTTPHeaderField: "X-Harness-Device") == device,
            "enrollment transport sends the exact chain path and device header")
        check(bench.hub.bearer(chain) == "Bearer \(hubToken)" &&
            sent?.url?.absoluteString.contains(hubToken) == false,
            "enrollment keeps the account session in its authorization header")
        check(bench.request(chain)?.refusal == .refused,
            "the renderer's generic account request cannot reach sealed enrollment")

        let request = try EnrollRequest(device: SealedDevice.create(enclave: false))
        do {
            _ = try await hub.open(request)
            check(false, "first-device bootstrap is disabled")
        } catch let failure as HubAccountFailure {
            check(failure.code == "no-enrolled-admin" && bench.hub.asked("/api/sync/v1/enroll").isEmpty,
                "first-device bootstrap is disabled even for signed-in accounts")
        }

        _ = bench.disconnect()
        do {
            _ = try await hub.send(.chain(-1), as: device)
            check(false, "an enrollment client cannot outlive its account session")
        } catch let failure as HubAccountFailure {
            check(failure == .superseded && bench.hub.asked(chain).count == 2,
                "an enrollment client cannot outlive its account session")
        }
    } catch {
        check(false, "synthetic enrollment transport completes")
    }
}
