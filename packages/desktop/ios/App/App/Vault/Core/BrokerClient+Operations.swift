import Foundation

extension BrokerClient {
    private struct PushSubscription: Encodable {
        let token: String?

        private enum CodingKeys: String, CodingKey { case kind, token }

        func encode(to encoder: Encoder) throws {
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode("apns-subscription-v1", forKey: .kind)
            try fields.encode(token, forKey: .token)
        }
    }

    public func pending(publishing key: VaultAddKeyPublication? = nil, sign: Sign) async throws -> Pending {
        guard let key else { return try await authenticated(.requests, payload: Data(), sign: sign) }
        do {
            return try await authenticated(.requests, payload: JSONEncoder().encode(key), sign: sign)
        } catch BrokerError.http(400) {
            return try await authenticated(.requests, payload: Data(), sign: sign)
        }
    }

    public func updatePushSubscription(deviceToken: Data?, sign: Sign) async throws {
        if let deviceToken, !(1...256).contains(deviceToken.count) {
            throw BrokerError.invalidDevice
        }
        let token = deviceToken.map { $0.map { String(format: "%02x", $0) }.joined() }
        let payload = try JSONEncoder().encode(PushSubscription(token: token))
        try await acknowledge(.requests, payload: payload, sign: sign)
    }

    public func decide(_ decision: Decision, sign: Sign) async throws {
        let response: Acknowledgment = try await authenticated(
            .decision, payload: JSONEncoder().encode(decision), sign: sign
        )
        guard response.ok else { throw BrokerError.malformedResponse }
    }

    public func decideVaultAdd(_ decision: VaultAddDecision, sign: Sign) async throws -> VaultAddDelivery? {
        let payload = try JSONEncoder().encode(decision)
        if decision.decision == .approve {
            return try await authenticated(.decision, payload: payload, sign: sign)
        }
        try await acknowledge(.decision, payload: payload, sign: sign)
        return nil
    }

    public func pendingImports(sign: Sign) async throws -> PendingImports {
        try await authenticated(.imports, payload: Data(), sign: sign)
    }

    public func decideImport(
        _ decision: PasswordImportDecision, sign: Sign
    ) async throws -> PasswordImportDelivery? {
        let payload = try JSONEncoder().encode(decision)
        if decision.decision == .approve {
            return try await authenticated(.importDecision, payload: payload, sign: sign)
        }
        try await acknowledge(.importDecision, payload: payload, sign: sign)
        return nil
    }

    public func privateBrowserOffer(sign: Sign) async throws -> PrivateBrowserOffer? {
        let reply: PrivateOfferReply = try await authenticated(
            .privateBrowserOffer, payload: Data("{}".utf8), sign: sign
        )
        _ = try reply.offer?.recipient(now: Int64(Date().timeIntervalSince1970 * 1_000))
        return reply.offer
    }

    /// The native caller confirms locally before providing the field. Only its sealed bytes are sent.
    public func submitPrivateBrowserFields(
        _ values: [String], for offer: PrivateBrowserOffer, sign: Sign
    ) async throws -> Bool {
        let payload = try offer.seal(values, now: Int64(Date().timeIntervalSince1970 * 1_000))
        let reply: PrivateSubmitReply = try await authenticated(.privateBrowserSubmit, payload: payload, sign: sign)
        return reply.status == .completed
    }

    public func completeImport(_ completion: PasswordImportCompletion, sign: Sign) async throws {
        try await acknowledge(.importComplete, payload: JSONEncoder().encode(completion), sign: sign)
    }
}
