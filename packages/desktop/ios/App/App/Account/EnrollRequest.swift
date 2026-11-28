import CryptoKit
import Foundation

struct EnrollOpening: Equatable {
    let deviceId: String
    let keys: SealedEnrollKeys
    let commit: String

    var fields: [String: String] {
        ["kemPublic": RemoteCoding.base64url(keys.kemPublic),
         "signingPublic": RemoteCoding.base64url(keys.signingPublic), "commit": commit]
    }

    static func == (lhs: EnrollOpening, rhs: EnrollOpening) -> Bool {
        lhs.deviceId == rhs.deviceId && lhs.fields == rhs.fields
    }

    func chainDevice(scopes: [String]) throws -> SealedChainDevice {
        _ = try P256.KeyAgreement.PublicKey(x963Representation: keys.kemPublic)
        _ = try P256.Signing.PublicKey(x963Representation: keys.signingPublic)
        guard let bytes = RemoteCoding.data(base64url: deviceId), bytes.count == 16,
            RemoteCoding.base64url(bytes) == deviceId else {
            throw SealedError("Enrollment device ID is malformed.")
        }
        return try SealedChainDevice(json: .object([
            "deviceId": .string(deviceId), "kemPublic": .string(fields["kemPublic"]!),
            "signingPublic": .string(fields["signingPublic"]!), "role": .string("admin"),
            "scopes": .array(scopes.map { .string($0) })
        ]))
    }
}

struct EnrollClaim: Equatable {
    let approver: String
    let nonce: Data
}

struct EnrollReceipt {
    let account: String
    let claim: EnrollClaim
    let approverSigningPublic: Data
    let entryHash: String
}

struct EnrolledDevice {
    let pin: SealedChainPin
    let keys: [String: SealedScopeKeys]
}

/// The joining device commits before receiving a claim. Its nonce stays local until that claim
/// is fixed by the caller. The returned pin and keys are ready to persist together.
struct EnrollRequest {
    let device: SealedDevice
    let nonce: Data
    let opening: EnrollOpening

    init(device: SealedDevice, nonce: Data = RemoteCoding.random(32)) throws {
        self.device = device
        self.nonce = nonce
        let keys = SealedEnrollKeys(kemPublic: device.kemPublic, signingPublic: device.signingPublic)
        opening = EnrollOpening(deviceId: device.deviceId, keys: keys,
                                commit: try SealedEnroll.commit(keys, nonce: nonce))
    }

    func code(claim: EnrollClaim, approverSigningPublic: Data) throws -> String {
        try SealedEnroll.code(request: opening.keys, requestNonce: nonce,
                              approverSigningPublic: approverSigningPublic, approverNonce: claim.nonce)
    }

    @available(iOS 17.0, macOS 14.0, *)
    func accept(
        entries: [SealedChainEntry], grants: [SealedGrant], approval: EnrollReceipt
    ) throws -> EnrolledDevice {
        let state = try SealedChain.verify(entries, account: approval.account)
        guard let entry = entries.first(where: { $0.hash == approval.entryHash }),
            entry.body["type"]?.text == "enroll", let enrolled = entry.body["device"],
            entry.by == approval.claim.approver, entry.verify(signingPublic: approval.approverSigningPublic),
            let current = state.devices[device.deviceId], current.active, !current.scopes.isEmpty
        else { throw SealedError("The verified chain does not contain the approval.") }
        let named = try SealedChainDevice(json: enrolled)
        guard named == (try opening.chainDevice(scopes: named.scopes)) else {
            throw SealedError("Approval names a different device or key.")
        }
        return try EnrolledDevice.open(state, grants: grants, as: device)
    }
}

@available(iOS 17.0, macOS 14.0, *)
extension EnrolledDevice {
    static func open(_ state: SealedChainState, grants: [SealedGrant], as device: SealedDevice) throws -> EnrolledDevice {
        guard let current = state.devices[device.deviceId], current.active, current.role == "admin",
            !current.scopes.isEmpty, current == SealedChainDevice(device, role: "admin", scopes: current.scopes)
        else { throw SealedError("The chain does not authorize this installation.") }
        var result: [String: SealedScopeKeys] = [:]
        for id in current.scopes {
            guard let scope = state.scopes[id], !scope.stale,
                let grant = grants.first(where: {
                    $0.scope == id && $0.epoch == scope.epoch && $0.device == device.deviceId
                })
            else { throw SealedError("The new device is missing a current scope grant.") }
            result[id] = try state.openGrant(grant, as: device)
        }
        return EnrolledDevice(pin: SealedChainPin(seq: state.seq, head: state.head), keys: result)
    }
}
