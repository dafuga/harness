import CryptoKit
import Foundation
import Network

// The real boundary of the phone: URLSession against local servers that redirect, refuse or
// close. Both servers listen on the loopback interface only and exist for one check.

final class LocalServer {
    private let listener: NWListener
    private let queue = DispatchQueue(label: "harness.check.server")
    private let respond: (String) -> Data
    private var heads: [String] = []

    init(respond: @escaping (String) -> Data) {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        parameters.acceptLocalOnly = true
        // swiftlint:disable:next force_try
        listener = try! NWListener(using: parameters, on: .any)
        self.respond = respond
        let ready = DispatchSemaphore(value: 0)
        listener.stateUpdateHandler = { state in
            if case .ready = state { ready.signal() }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { return }
            connection.start(queue: self.queue)
            self.read(connection, Data())
        }
        listener.start(queue: queue)
        _ = ready.wait(timeout: .now() + 3)
    }

    var port: UInt16 { listener.port?.rawValue ?? 0 }
    var seen: [String] { queue.sync { heads } }

    func stop() {
        listener.cancel()
    }

    private func read(_ connection: NWConnection, _ buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, done, error in
            guard let self = self else { return }
            let all = buffer + (data ?? Data())
            if let head = String(data: all, encoding: .utf8), head.contains("\r\n\r\n") {
                self.heads.append(head)
                connection.send(content: self.respond(head), completion: .contentProcessed { _ in connection.cancel() })
            } else if done || error != nil {
                connection.cancel()
            } else {
                self.read(connection, all)
            }
        }
    }
}

private func answer(_ status: String, _ headers: String = "", body: String = "") -> Data {
    Data("HTTP/1.1 \(status)\r\n\(headers)Content-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n\(body)".utf8)
}
private func redirect(_ code: Int, to port: UInt16) -> Data {
    answer("\(code) Redirect", "Location: http://127.0.0.1:\(port)/taken\r\n")
}
/// A completed WebSocket upgrade followed at once by a close frame with this code.
private func closing(_ head: String, code: UInt16) -> Data {
    let key = head.components(separatedBy: "\r\n").first { $0.lowercased().hasPrefix("sec-websocket-key:") }
    let value = key?.split(separator: ":").last.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
    let digest = Insecure.SHA1.hash(data: Data((value + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").utf8))
    let accept = Data(digest).base64EncodedString()
    let upgrade = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: \(accept)\r\n\r\n"
    return Data(upgrade.utf8) + Data([0x88, 0x02, UInt8(code >> 8), UInt8(code & 0xff)])
}

func httpRedirectChecks() {
    let target = LocalServer { _ in answer("200 OK", "Content-Type: application/json\r\n", body: "{}") }
    for code in [307, 308] {
        let relay = LocalServer { _ in redirect(code, to: target.port) }
        let client = RemoteRelayClient()
        var outcome: Result<[String: Any], RemoteFailure>?
        let origin = URL(string: "http://127.0.0.1:\(relay.port)")
        client.post(origin!, "v1/hosts/check/pairings/check/request", body: ["sealed": "check-body"]) { outcome = $0 }
        wait { outcome != nil }
        var failed = false
        if case .failure? = outcome { failed = true }
        check(failed, "HTTP \(code) from a relay ends the request as a failure")
        check(relay.seen.count == 1 && target.seen.isEmpty, "HTTP \(code): the body went to the relay and to no other address")
        client.close()
        relay.stop()
    }
    let relay = LocalServer { _ in redirect(307, to: target.port) }
    var followed = false
    URLSession(configuration: .ephemeral).dataTask(with: URL(string: "http://127.0.0.1:\(relay.port)/control")!) { _, _, _ in
        followed = true
    }.resume()
    wait { followed }
    check(target.seen.count == 1, "control: the same fixture is followed by a client that does not refuse redirects")
    relay.stop()
    target.stop()
}

/// Opens a real channel to a local server and reports how it ended.
private func ending(_ server: LocalServer) -> LinkWatcher {
    var record = Bench.record()
    record.origin = "http://127.0.0.1:\(server.port)"
    let queue = DispatchQueue(label: "harness.check.channel")
    let watcher = LinkWatcher()
    let channel = RemoteChannel(record: record, queue: queue)
    channel.delegate = watcher
    queue.sync { channel.open() }
    wait(3) { !watcher.closures.isEmpty }
    queue.sync { channel.close() }
    return watcher
}

func socketChecks() {
    let target = LocalServer { _ in answer("200 OK") }
    let relay = LocalServer { _ in redirect(307, to: target.port) }
    #if DEBUG
    RemoteDebug.loopback = false
    check(ending(relay).closures == [.lost] && relay.seen.isEmpty, "Debug without the opt-in: a local relay is refused before any connection")
    RemoteDebug.loopback = true
    let redirected = ending(relay)
    check(redirected.closures == [.lost] && redirected.ready == 0, "a redirected WebSocket upgrade ends the link and is never ready")
    check(relay.seen.count == 1 && (relay.seen.first ?? "").contains("Authorization: Bearer "), "the upgrade reached the relay with its Authorization header")
    check(target.seen.isEmpty, "no upgrade and no Authorization header reached the other address")
    for round in 1...5 {
        let denied = LocalServer { _ in answer("401 Unauthorized", "Content-Type: application/json\r\n", body: "{\"error\":\"credential-invalid\"}") }
        check(ending(denied).closures == [.revoked], "an upgrade the relay answers with 401 ends the link as revoked (round \(round))")
        denied.stop()
        let revoking = LocalServer { closing($0, code: 4401) }
        check(ending(revoking).closures == [.revoked], "a socket the relay closes with 4401 ends the link as revoked (round \(round))")
        revoking.stop()
    }
    let replaced = LocalServer { closing($0, code: 4409) }
    check(ending(replaced).closures == [.lost], "a socket closed with another code is a loss, not a revocation")
    replaced.stop()
    RemoteDebug.loopback = false
    #else
    let refused = ending(relay)
    check(refused.closures == [.lost], "Release: a link to a local relay ends before it starts")
    check(relay.seen.isEmpty && target.seen.isEmpty, "Release: nothing was sent to a local address")
    #endif
    relay.stop()
    target.stop()
}
