import Foundation

/// The sealed identity is available only to the current installation's Hub login.
struct HubLoginDeviceStore: SealedSecretStore {
    let base: SealedSecretStore
    let prefix: String

    init(_ credential: HubAccountCredential, base: SealedSecretStore) throws {
        guard let binding = credential.installationBinding else { throw HubAccountFailure.unkept }
        self.base = base
        let label = [credential.origin, credential.subject, binding.uuidString].joined(separator: "\0")
        prefix = "hub-login-" + RemoteCoding.hex(RemoteCoding.sha256(Data(label.utf8))) + "-"
    }

    func load(_ name: String) -> Data? { base.load(prefix + name) }
    func save(_ name: String, _ data: Data) throws { try base.save(prefix + name, data) }
    func remove(_ name: String) { base.remove(prefix + name) }
}

enum HubDeviceStage: String {
    case checking = "checking-device", first = "first-device", waiting = "waiting-for-approval", approved
}

extension HubAccountSession {
    private static let devicePath = "/api/sync/v1/device-session"

    func checkDevice(_ credential: HubAccountCredential, _ origin: URL, _ done: @escaping Status) {
        deviceCheck += 1
        deviceStage = .checking
        enrolledDevice = nil
        let device: SealedDevice
        do {
            let store = try HubLoginDeviceStore(credential, base: loginKeys)
            if let kept = try SealedDeviceStore.load(from: store) { device = kept }
            else {
                device = try makeLoginDevice()
                try SealedDeviceStore.save(device, to: store)
            }
        } catch {
            deviceStage = .checking
            return done(.failure(.unkept))
        }
        let attempt = deviceCheck
        var call = HubAccountCall(method: "GET", path: Self.devicePath)
        call.device = device.deviceId
        send(call, origin, credential.token) { result in
            guard attempt == self.deviceCheck else { return done(.failure(.superseded)) }
            guard case .success(let reply) = result else {
                self.deviceStage = .checking
                return done(result.map { _ in self.snapshot })
            }
            let body = RemoteCoding.object(reply.data)
            if reply.status == 200, body?["state"] as? String == "proof-required" {
                self.proveDevice(device, challenge: body?["challenge"], credential: credential, done)
            } else if reply.status == 200, body?["state"] as? String == "waiting-for-approval" {
                self.waitForApproval(device, attempt: attempt, done)
            } else { self.finishDevice(reply, device: device, done) }
        }
    }

    private func waitForApproval(_ device: SealedDevice, attempt: Int, _ done: @escaping Status) {
        deviceStage = .checking
        enrollment.open(self, device: device) { result in
            guard attempt == self.deviceCheck else { return done(.failure(.superseded)) }
            if case .success = result { self.deviceStage = .waiting }
            done(result.map { self.snapshot })
        }
    }

    private func proveDevice(
        _ device: SealedDevice, challenge value: Any?, credential: HubAccountCredential, _ done: @escaping Status
    ) {
        deviceStage = .checking
        guard let origin, let challenge = value as? String,
            let bytes = RemoteCoding.data(base64url: challenge), bytes.count == 32,
            RemoteCoding.base64url(bytes) == challenge else { return done(.failure(.failed)) }
        let message = Data(("harness/sealed/v1/session\0" + challenge).utf8)
        guard let signature = try? device.signing.sign(message) else { return done(.failure(.unkept)) }
        let proof = RemoteCoding.json(["challenge": challenge, "signature": RemoteCoding.base64url(signature)])
        let attempt = deviceCheck
        var call = HubAccountCall(method: "POST", path: Self.devicePath, body: proof)
        call.device = device.deviceId
        send(call, origin, credential.token) { result in
            guard attempt == self.deviceCheck else { return done(.failure(.superseded)) }
            switch result {
            case .failure(let failure): done(.failure(failure))
            case .success(let reply): self.finishDevice(reply, device: device, done)
            }
        }
    }

    private func finishDevice(_ reply: HubAccountReply, device: SealedDevice, _ done: @escaping Status) {
        if reply.status == 401 {
            erase()
            return done(.success(snapshot))
        }
        guard reply.status == 200, let name = RemoteCoding.object(reply.data)?["state"] as? String,
            let stage = HubDeviceStage(rawValue: name), stage != .checking
        else {
            deviceStage = .checking
            return done(.failure(.failed))
        }
        if stage == .approved { return verifyAdmission(device, done) }
        enrolledDevice = nil
        deviceStage = stage
        done(.success(snapshot))
    }

    func authorizedCall(_ call: HubAccountCall, _ origin: URL, _ done: @escaping Answer) {
        withApprovedDevice { result in
            switch result {
            case .failure(let failure): done(.failure(failure))
            case .success(let credential):
                self.send(call, origin, credential.token) { answer in
                    if case .success(let reply) = answer, reply.status == 401 { self.erase() }
                    done(answer)
                }
            }
        }
    }

    /// Recheck on cold entry. Pending and unknown installations have no project or computer access.
    func withApprovedDevice(_ done: @escaping (Result<HubAccountCredential, HubAccountFailure>) -> Void) {
        guard let origin, let credential = live() else { return done(.failure(.signedOut)) }
        if deviceStage == .approved { return done(.success(credential)) }
        guard deviceStage == .checking else { return done(.failure(.refused)) }
        confirm(origin) { answer in
            guard case .success = answer, self.deviceStage == .approved, let current = self.live(),
                current.token == credential.token else { return done(.failure(.refused)) }
            done(.success(current))
        }
    }
}
