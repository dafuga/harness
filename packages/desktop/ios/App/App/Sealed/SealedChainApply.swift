import Foundation

/// What each verified entry does to the state: who holds which scope and which epoch is current.
extension SealedChainState {
    private static func fail(_ message: String) -> SealedError { SealedChain.fail(message) }

    static func genesis(_ entry: SealedChainEntry, account: String) throws -> SealedChainState {
        guard entry.seq == 0, entry.prev == "" else { throw fail("genesis must come first") }
        guard entry.body["account"]?.text == account else { throw fail("chain belongs to another account") }
        var state = SealedChainState(account: account, seq: 0, head: "", devices: [:], scopes: [:])
        for scope in entry.body["scopes"]?.items ?? [] { try state.addScope(SealedScopeCommitment(json: scope)) }
        for device in entry.body["devices"]?.items ?? [] { try state.addDevice(SealedChainDevice(json: device)) }
        return state
    }

    private mutating func addScope(_ scope: SealedScopeCommitment) throws {
        guard scopes[scope.scope] == nil, scope.epoch == 0 else {
            throw Self.fail("scope exists or starts after epoch 0")
        }
        scopes[scope.scope] = SealedChainScope(epoch: 0, commitments: [0: scope.commitment], stale: false)
    }

    private mutating func addDevice(_ device: SealedChainDevice) throws {
        guard devices[device.deviceId] == nil else { throw Self.fail("device id reused") }
        guard device.scopes.allSatisfy({ scopes[$0] != nil }) else {
            throw Self.fail("device holds an unknown scope")
        }
        devices[device.deviceId] = device
    }

    mutating func apply(_ entry: SealedChainEntry, type: String) throws {
        switch type {
        case "enroll":
            let device = try SealedChainDevice(json: entry.body["device"] ?? .null)
            if device.role == "recovery" { throw Self.fail("only genesis creates the recovery device") }
            try addDevice(device)
        case "revoke": try revoke(entry.body["device"]?.text)
        case "rotate": try rotate(SealedScopeCommitment(json: entry.body["commitment"]))
        case "scope": try grantScope(entry)
        default: throw Self.fail("genesis appears twice")
        }
    }

    private mutating func revoke(_ id: String?) throws {
        guard let id, devices[id]?.active == true else { throw Self.fail("revoked device is not active") }
        devices[id]!.active = false
        for scope in devices[id]!.scopes { scopes[scope]?.stale = true }
    }

    private mutating func rotate(_ commitment: SealedScopeCommitment) throws {
        guard var scope = scopes[commitment.scope], commitment.epoch == scope.epoch + 1 else {
            throw Self.fail("rotation skips an epoch")
        }
        scope.epoch = commitment.epoch
        scope.commitments[commitment.epoch] = commitment.commitment
        scope.stale = false
        scopes[commitment.scope] = scope
    }

    private mutating func grantScope(_ entry: SealedChainEntry) throws {
        let commitment = try SealedScopeCommitment(json: entry.body["commitment"])
        try addScope(commitment)
        let listed = entry.body["devices"]?.items?.compactMap(\.text) ?? []
        for id in Set([entry.by] + listed) {
            guard devices[id]?.active == true else { throw Self.fail("scope granted to an inactive device") }
            devices[id]!.scopes = (devices[id]!.scopes + [commitment.scope]).sorted()
        }
    }
}
