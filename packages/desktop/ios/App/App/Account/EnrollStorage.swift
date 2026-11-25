import Foundation
import CryptoKit

/// Keep this origin and account's device keys and verified pin distinct from every other login.
struct EnrollStorage: SealedSecretStore {
    private let base: SealedSecretStore
    private let prefix: String

    init(origin: URL, account: String, store: SealedSecretStore = SealedKeychain()) {
        base = store
        prefix = "enroll-" + RemoteCoding.hex(RemoteCoding.sha256(Data("\(origin.absoluteString)\0\(account)".utf8)))
    }

    func load(_ name: String) -> Data? { base.load(prefix + "-" + name) }
    func save(_ name: String, _ data: Data) throws { try base.save(prefix + "-" + name, data) }
    func remove(_ name: String) { base.remove(prefix + "-" + name) }

    static func publicStatus(_ status: [String: Any], origin: URL?) -> [String: Any] {
        guard #available(iOS 17.0, *), status["state"] as? String == "signed-in",
            let origin, let actor = status["actor"] as? [String: Any],
            let id = actor["id"] as? String else { return status }
        var output = status
        let storage = EnrollStorage(origin: origin, account: id)
        output["sealedApprovalRequired"] = (try? storage.pin()) == nil
        return output
    }

    func device() throws -> SealedDevice? { try SealedDeviceStore.load(from: self) }

    func joiningDevice() throws -> SealedDevice {
        if let kept = try device() { return kept }
        guard SecureEnclave.isAvailable else { throw SealedError("Secure Enclave is unavailable.") }
        let device = try SealedDevice.create(enclave: true)
        try SealedDeviceStore.save(device, to: self)
        return device
    }

    func queueName(_ name: String, scope: String) throws {
        let json = SealedJson.object(["name": .string(name), "scope": .string(scope)])
        try save("pending-name", Data(json.canonical.utf8))
    }

    func publishName(_ hub: EnrollHub, device: String, keys: [String: SealedScopeKeys]) async throws {
        guard let data = load("pending-name") else { return }
        let json = try SealedJson.parse(data)
        guard let name = json["name"]?.text, let scope = json["scope"]?.text, let accountKeys = keys[scope]
        else { throw SealedError("The device name could not be sealed.") }
        try await hub.writeName(name, device: device, keys: accountKeys)
        remove("pending-name")
    }

    func pin() throws -> SealedChainPin? {
        guard let data = load("pin") else { return nil }
        let json = try SealedJson.parse(data)
        guard let seq = json["seq"]?.number, seq >= 0, let head = json["head"]?.text,
            HubAccountPolicy.matches(head, "\\A[0-9a-f]{64}\\z")
        else { throw SealedError("The stored device chain pin is malformed.") }
        return SealedChainPin(seq: seq, head: head)
    }

    func pin(_ next: SealedChainPin) throws {
        if let previous = try pin() {
            guard previous.seq <= next.seq, previous.seq != next.seq || previous.head == next.head
            else { throw SealedError("The device chain went backwards.") }
        }
        let json = SealedJson.object(["seq": .int(next.seq), "head": .string(next.head)])
        try save("pin", Data(json.canonical.utf8))
    }
}
