import Foundation

@available(iOS 17.0, macOS 14.0, *)
extension TrackerSealedAuthority {
    func device() throws -> SealedDevice? {
        guard let device = try SealedDeviceStore.load(from: self) else { return nil }
        #if os(iOS)
        guard case .enclave = device.kem, case .enclave = device.signing else {
            throw HubAccountFailure.refused
        }
        #endif
        return device
    }

    func verifiedKeys(_ hub: TrackerSealedHub, device: SealedDevice) async throws -> [String: TrackerReplicaSessionKeys] {
        guard let pin = try pin() else { throw HubAccountFailure.refused }
        let entries = try await hub.chain()
        let chain = try SealedChain.verify(entries, account: identity.subject, pin: pin)
        guard let active = chain.devices[device.deviceId], active.active else {
            forgetKeys()
            throw TrackerSealedRevoked()
        }
        var cached = try cached(pin)
        cached = cached.filter { active.scopes.contains($0.key) }
        if chain.head == pin.head, !cached.isEmpty, active.scopes.allSatisfy({ cached[$0] != nil }) { return cached }
        let grants = try await hub.grants()
        var ready: [String: TrackerReplicaSessionKeys] = [:]
        for name in Set(active.scopes) {
            guard let scope = chain.scopes[name] else { continue }
            var epochs = (cached[name]?.epochs ?? [:]).filter {
                RemoteCoding.base64url($0.value.commitment) == scope.commitments[$0.key]
            }
            for grant in grants where grant.scope == name && epochs[grant.epoch] == nil {
                epochs[grant.epoch] = try chain.openGrant(grant, as: device)
            }
            guard let current = epochs[scope.epoch] else { continue }
            ready[name] = TrackerReplicaSessionKeys(current: current, epochs: epochs)
        }
        try Task.checkCancellation()
        if chain.head != pin.head || !ready.isEmpty { try store(chain, scopes: ready) }
        return ready
    }
}

struct TrackerSealedRevoked: Error {}
