import Foundation

@available(iOS 17.0, macOS 14.0, *)
extension EnrollHub {
    /// A native admin refreshes its view from its pin before wrapping any key.
    func admin(_ device: SealedDevice, pin: SealedChainPin) async throws -> EnrollAdmin {
        let history = try await entries(as: device.deviceId)
        let state = try SealedChain.verify(history, account: account, pin: pin)
        let grants = try await grants(as: device.deviceId)
        var keys: [String: SealedScopeKeys] = [:]
        for grant in grants where state.scopes[grant.scope]?.epoch == grant.epoch {
            if let opened = try? state.openGrant(grant, as: device) { keys[grant.scope] = opened }
        }
        let admin = EnrollAdmin(device: device, state: state, keys: keys)
        _ = try admin.activeAdmin()
        return admin
    }

    func revoke(_ target: String, admin: EnrollAdmin) async throws -> SealedChainPin? {
        guard await EnrollBiometrics.authenticate(reason: "Revoke this device and rotate its scope keys.")
        else { return nil }
        let change = try admin.revoke(target, at: Int64(Date().timeIntervalSince1970 * 1000))
        let pin = try await publish(change, as: admin.device.deviceId)
        try EnrollStorage(origin: origin, account: account).pin(pin)
        return pin
    }
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class EnrollJoin {
    let request: EnrollRequest
    let id: String
    let hub: EnrollHub
    private var locked: EnrollComparison?
    private var comparing = false

    init(request: EnrollRequest, id: String, hub: EnrollHub) {
        self.request = request
        self.id = id
        self.hub = hub
    }

    func compare() async throws -> EnrollComparison? {
        guard !comparing else { throw HubAccountFailure.refused }
        comparing = true
        defer { comparing = false }
        let device = request.device.deviceId
        let mailbox = try await hub.mailbox(id, as: device)
        guard try mailbox.opening() == request.opening else { throw HubAccountFailure.failed }
        guard let claim = try mailbox.claim() else { return nil }
        let comparison = try await lock(claim)
        if let revealed = try mailbox.reveal() {
            guard revealed == request.nonce else { throw HubAccountFailure.failed }
        } else {
            try await hub.append(["nonce": RemoteCoding.base64url(request.nonce)], to: id, as: device)
        }
        return comparison
    }

    private func lock(_ claim: EnrollClaim) async throws -> EnrollComparison {
        if let locked {
            guard locked.claim == claim else { throw HubAccountFailure.failed }
            return locked
        }
        let device = request.device.deviceId
        let history = try await hub.entries(as: device)
        let state = try SealedChain.verify(history, account: hub.account)
        guard let approver = state.devices[claim.approver], approver.active, approver.role == "admin",
            let key = RemoteCoding.data(base64url: approver.signingPublic)
        else { throw HubAccountFailure.failed }
        let code = try request.code(claim: claim, approverSigningPublic: key)
        let comparison = EnrollComparison(code: code, claim: claim, approverKey: key)
        locked = comparison
        return comparison
    }

    func complete(name: String) async throws -> EnrolledDevice? {
        guard let comparison = locked, !comparing else { throw HubAccountFailure.refused }
        let device = request.device.deviceId
        let claim = comparison.claim
        let history = try await hub.entries(as: device)
        guard let entry = history.first(where: {
            $0.by == claim.approver && $0.body["type"]?.text == "enroll"
                && $0.body["device"]?["deviceId"]?.text == device
        }) else { return nil }
        let receipt = EnrollReceipt(account: hub.account, claim: claim,
                                   approverSigningPublic: comparison.approverKey, entryHash: entry.hash)
        let grants = try await hub.grants(as: device)
        let enrolled = try request.accept(entries: history, grants: grants, approval: receipt)
        guard let scope = history[0].body["scopes"]?.items?.first?["scope"]?.text,
            enrolled.keys[scope] != nil else { throw HubAccountFailure.failed }
        let storage = EnrollStorage(origin: hub.origin, account: hub.account)
        try storage.queueName(name, scope: scope)
        try storage.pin(enrolled.pin)
        try await storage.publishName(hub, device: device, keys: enrolled.keys)
        return enrolled
    }
}

struct EnrollComparison {
    let code: String
    let claim: EnrollClaim
    let approverKey: Data
}

@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class EnrollReview {
    let id: String
    let hub: EnrollHub
    let admin: EnrollAdmin
    private var transcript: (opening: EnrollOpening, claim: EnrollClaim)?
    private var claiming = false

    init(id: String, hub: EnrollHub, admin: EnrollAdmin) {
        self.id = id
        self.hub = hub
        self.admin = admin
    }

    func claim() async throws -> EnrollClaim {
        guard !claiming else { throw HubAccountFailure.refused }
        claiming = true
        defer { claiming = false }
        let device = admin.device.deviceId
        let mailbox = try await hub.mailbox(id, as: device)
        _ = try admin.activeAdmin()
        let opening = try mailbox.opening()
        guard admin.state.devices[opening.deviceId] == nil else { throw HubAccountFailure.refused }
        let current = try mailbox.claim()
        if let transcript {
            guard transcript.opening == opening else { throw HubAccountFailure.failed }
            if let current {
                guard current == transcript.claim else { throw HubAccountFailure.failed }
                return transcript.claim
            }
        } else {
            guard current == nil else { throw HubAccountFailure.refused }
            transcript = (opening, EnrollClaim(approver: device, nonce: RemoteCoding.random(32)))
        }
        guard let claim = transcript?.claim else { throw HubAccountFailure.failed }
        try await hub.append(["approver": device, "nonce": RemoteCoding.base64url(claim.nonce)], to: id, as: device)
        return claim
    }

    func compare() async throws -> EnrollApproval? {
        guard let transcript, !claiming else { throw HubAccountFailure.refused }
        let claim = transcript.claim
        let mailbox = try await hub.mailbox(id, as: admin.device.deviceId)
        guard try mailbox.claim() == claim, try mailbox.opening() == transcript.opening else { throw HubAccountFailure.failed }
        guard let reveal = try mailbox.reveal() else { return nil }
        return try EnrollApproval(opening: mailbox.opening(), claim: claim, reveal: reveal, approver: admin.device)
    }

    func approve(_ approval: EnrollApproval) async throws -> SealedChainPin? {
        let change = try await approval.authorize(with: admin, at: Int64(Date().timeIntervalSince1970 * 1000)) {
            await EnrollBiometrics.authenticate(reason: "Approve the device with the matching code.")
        }
        guard let change else { return nil }
        let pin = try await hub.publish(change, as: admin.device.deviceId)
        try EnrollStorage(origin: hub.origin, account: hub.account).pin(pin)
        try? await hub.append(["entryHash": pin.head], to: id, as: admin.device.deviceId)
        return pin
    }
}
