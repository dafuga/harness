import Foundation

struct EnrollChange {
    let entries: [SealedChainEntry]
    let grants: [SealedGrant]
}

/// A chain update prepared against a verified head. Callers commit all entries and grants as a
/// single change, or discard them and review a conflict against the current head.
@available(iOS 17.0, macOS 14.0, *)
struct EnrollAdmin {
    let device: SealedDevice
    let state: SealedChainState
    let keys: [String: SealedScopeKeys]

    func activeAdmin() throws -> SealedChainDevice {
        guard let signer = state.devices[device.deviceId], signer.active, signer.role == "admin",
            signer.signingPublic == RemoteCoding.base64url(device.signingPublic)
        else { throw SealedError("An active admin device must authorize this change.") }
        return signer
    }

    func currentKeys(_ scope: String, allowStale: Bool = false) throws -> SealedScopeKeys {
        guard let current = state.scopes[scope], allowStale || !current.stale,
            let local = keys[scope], local.name == scope, local.epoch == current.epoch,
            RemoteCoding.base64url(local.commitment) == current.commitments[current.epoch]
        else { throw SealedError("The admin is missing the committed scope keys.") }
        return local
    }

    func revoke(_ id: String, at: Int64) throws -> EnrollChange {
        _ = try activeAdmin()
        guard let target = state.devices[id], target.active, id != device.deviceId,
            target.role != "recovery"
        else { throw SealedError("This device cannot be revoked here.") }

        let stale = state.scopes.filter { $0.value.stale }.map(\.key)
        let scopes = Set(target.scopes + stale).sorted()
        let rotations = try scopes.map { scope in
            let previous = try currentKeys(scope, allowStale: true)
            guard previous.epoch < UInt32.max else { throw SealedError("Scope epoch is exhausted.") }
            return SealedRawScopeKeys.make(rotating: previous.raw)
        }

        let body = SealedJson.object(["type": .string("revoke"), "device": .string(id)])
        var entries = [try sign(body, after: nil, at: at)]
        var grants: [SealedGrant] = []
        for raw in rotations {
            let commitment = try SealedScopeCommitment(raw)
            let rotate = SealedJson.object(["type": .string("rotate"), "commitment": commitment.json])
            entries.append(try sign(rotate, after: entries.last, at: at))
            let remaining = state.devices.values.filter {
                $0.active && $0.deviceId != id && $0.scopes.contains(commitment.scope)
            }
            grants += try remaining.sorted { $0.deviceId < $1.deviceId }.map { try grant(raw, to: $0) }
        }
        return EnrollChange(entries: entries, grants: grants)
    }

    func sign(_ body: SealedJson, after previous: SealedChainEntry?, at: Int64) throws -> SealedChainEntry {
        let entry = SealedChainEntry(seq: (previous?.seq ?? state.seq) + 1,
                                     prev: previous?.hash ?? state.head, at: at, body: body)
        return try device.sign(entry)
    }

    func grant(_ raw: SealedRawScopeKeys, to recipient: SealedChainDevice) throws -> SealedGrant {
        guard let key = RemoteCoding.data(base64url: recipient.kemPublic) else {
            throw SealedError("A device is missing its grant key.")
        }
        return try SealedGrantCrypto.wrap(account: state.account, raw: raw, deviceId: recipient.deviceId,
                                          recipientPublic: key)
    }
}
