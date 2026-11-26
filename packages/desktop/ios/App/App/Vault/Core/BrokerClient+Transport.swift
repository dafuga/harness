import Foundation

extension BrokerClient {
    private struct ChallengeRequest: Encodable {
        let path: String
        let expiresAt: Int64
    }
    private struct Challenge: Decodable { let nonce: String; let expiresAt: Int64 }
    private struct Envelope: Encodable {
        let deviceId: String
        let nonce: String
        let payload: String
        let signature: String
    }

    public func submitPairing(_ submission: PairingSubmission, for exchange: PairingExchange) async throws {
        guard exchange.offer.origin == origin,
              exchange.offer.nonce == submission.nonce,
              exchange.phonePublicKey == submission.phonePublicKey else { throw BrokerError.invalidOrigin }
        try exchange.offer.checkExpiry()
        try Task.checkCancellation()
        let response: Acknowledgment = try await post(
            "/v1/device/pair/submit", body: submission
        )
        guard response.ok else { throw BrokerError.malformedResponse }
    }

    func authenticated<Response: Decodable>(
        _ path: BrokerPath, payload: Data, sign: Sign
    ) async throws -> Response {
        let proof = try await challenge(for: path, sign: sign)
        return try await signedPost(path, nonce: proof.nonce, payload: payload, sign: sign)
    }

    func acknowledge(_ path: BrokerPath, payload: Data, sign: Sign) async throws {
        let response: Acknowledgment = try await authenticated(path, payload: payload, sign: sign)
        guard response.ok else { throw BrokerError.malformedResponse }
    }

    public func verifyEnrollment(sign: Sign) async throws {
        _ = try await challenge(for: .requests, sign: sign)
    }

    private func challenge(for path: BrokerPath, sign: Sign) async throws -> Challenge {
        let nonce = try BrokerProtocol.base64url(BrokerProtocol.random32Bytes())
        let expiresAt = Int64(Date().timeIntervalSince1970 * 1_000) + 30_000
        let payload = try JSONEncoder().encode(ChallengeRequest(path: path.rawValue, expiresAt: expiresAt))
        let challenge: Challenge
        do {
            challenge = try await signedPost(.challenge, nonce: nonce, payload: payload, sign: sign)
        } catch BrokerError.http(400) where path == .imports {
            // Brokers that predate imports reject its challenge path with 400.
            throw BrokerError.http(404)
        }
        _ = try BrokerProtocol.decode(challenge.nonce, size: 32)
        guard challenge.expiresAt > 0 else { throw BrokerError.malformedResponse }
        return challenge
    }

    private func signedPost<Response: Decodable>(
        _ path: BrokerPath, nonce: String, payload: Data, sign: Sign
    ) async throws -> Response {
        try Task.checkCancellation()
        let input = BrokerProtocol.signingInput(
            for: .init(origin: origin, deviceID: deviceID), path: path, nonce: nonce, payload: payload
        )
        let signature = try await sign(input)
        try Task.checkCancellation()
        guard signature.count == 64 else { throw BrokerError.invalidDevice }
        return try await post(path.rawValue, body: Envelope(
            deviceId: deviceID, nonce: nonce, payload: BrokerProtocol.base64url(payload),
            signature: BrokerProtocol.base64url(signature)
        ))
    }

    private func post<Response: Decodable>(_ path: String, body: some Encodable) async throws -> Response {
        guard let url = URL(string: origin + path) else { throw BrokerError.invalidOrigin }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.httpShouldHandleCookies = false
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        let (bytes, response) = try await transport.bytes(for: request)
        guard let http = response as? HTTPURLResponse, http.url == url else { throw BrokerError.transport }
        if Self.isAccessGate(http) { throw BrokerError.routeProtected }
        guard http.statusCode == 200 else { throw BrokerError(httpStatus: http.statusCode) }
        guard http.mimeType == "application/json" else { throw BrokerError.malformedResponse }
        var data = Data()
        for try await byte in bytes {
            guard data.count < 512 * 1_024 else { throw BrokerError.malformedResponse }
            data.append(byte)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }

    private static func isAccessGate(_ response: HTTPURLResponse) -> Bool {
        if (300..<400).contains(response.statusCode),
           let location = response.value(forHTTPHeaderField: "Location"),
           let host = URL(string: location)?.host?.lowercased(),
           host.hasSuffix(".cloudflareaccess.com") { return true }
        return response.mimeType == "text/html" && [200, 401, 403].contains(response.statusCode)
    }
}
