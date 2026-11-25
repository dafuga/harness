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

    func device() throws -> SealedDevice? { try SealedDeviceStore.load(from: self) }

    func joiningDevice() throws -> SealedDevice {
        if let kept = try device() { return kept }
        guard SecureEnclave.isAvailable else { throw SealedError("Secure Enclave is unavailable.") }
        let device = try SealedDevice.create(enclave: true)
        try SealedDeviceStore.save(device, to: self)
        return device
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
