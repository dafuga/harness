import Foundation

/// A device as the chain lists it. Keys are base64url uncompressed points; scopes are base64url ids.
struct SealedChainDevice: Equatable {
    let deviceId: String
    let kemPublic: String
    let signingPublic: String
    let role: String
    var scopes: [String]
    var active = true

    /// A device of ours as the chain lists it.
    init(_ device: SealedDevice, role: String, scopes: [String]) {
        deviceId = device.deviceId
        kemPublic = RemoteCoding.base64url(device.kemPublic)
        signingPublic = RemoteCoding.base64url(device.signingPublic)
        (self.role, self.scopes) = (role, scopes.sorted())
    }

    var json: SealedJson {
        .object([
            "deviceId": .string(deviceId), "kemPublic": .string(kemPublic),
            "signingPublic": .string(signingPublic), "role": .string(role),
            "scopes": .array(scopes.map { .string($0) })
        ])
    }

    init(json: SealedJson) throws {
        guard let id = json["deviceId"]?.text, let kem = json["kemPublic"]?.text,
            let signing = json["signingPublic"]?.text, let role = json["role"]?.text,
            let scopes = json["scopes"]?.items?.map(\.text)
        else { throw SealedError("Chain device is malformed.") }
        guard !scopes.contains(nil) else { throw SealedError("Chain device scope is malformed.") }
        (deviceId, kemPublic, signingPublic, self.role) = (id, kem, signing, role)
        self.scopes = scopes.compactMap { $0 }
    }
}

/// The commitment the chain records for one scope epoch.
struct SealedScopeCommitment: Equatable {
    let scope: String
    let epoch: UInt32
    let commitment: String

    /// The chain's record of a scope's keys at one epoch.
    init(_ raw: SealedRawScopeKeys) throws {
        scope = RemoteCoding.base64url(raw.scopeId)
        epoch = raw.epoch
        commitment = RemoteCoding.base64url(try raw.commitment())
    }

    var json: SealedJson {
        .object(["scope": .string(scope), "epoch": .int(Int64(epoch)), "commitment": .string(commitment)])
    }

    init(json: SealedJson?) throws {
        guard let scope = json?["scope"]?.text, let epoch = json?["epoch"]?.number,
            let commitment = json?["commitment"]?.text, epoch >= 0, epoch <= Int64(UInt32.max)
        else { throw SealedError("Scope commitment is malformed.") }
        (self.scope, self.epoch, self.commitment) = (scope, UInt32(epoch), commitment)
    }
}

struct SealedChainScope: Equatable {
    var epoch: UInt32
    var commitments: [UInt32: String]
    /// A device holding this scope was revoked after its newest epoch; rotate before writing.
    var stale: Bool
}

/// What a client remembers so the server cannot roll it back or fork it.
struct SealedChainPin: Codable, Equatable {
    let seq: Int64
    let head: String
}

/// The verified result of a whole chain: who holds which scopes, and the head to pin.
struct SealedChainState {
    let account: String
    var seq: Int64
    var head: String
    var devices: [String: SealedChainDevice]
    var scopes: [String: SealedChainScope]
}
