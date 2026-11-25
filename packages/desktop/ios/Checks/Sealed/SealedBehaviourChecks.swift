import CryptoKit
import Foundation

final class MemoryStore: SealedSecretStore {
    var items: [String: Data] = [:]
    func load(_ name: String) -> Data? { items[name] }
    func save(_ name: String, _ data: Data) throws { items[name] = data }
    func remove(_ name: String) { items[name] = nil }
}

func checkPadding() {
    let buckets = [(0, 256), (252, 256), (253, 512), (60_000, 65_536), (65_532, 65_536), (65_533, 131_072)]
    for (length, bucket) in buckets {
        check(SealedPadding.bucket(for: length) == bucket, "padding bucket for \(length) bytes")
    }
    let data = Data("hello".utf8)
    check((try? SealedPadding.unpad(SealedPadding.pad(data))) == data, "padding round trip")
    var dirty = SealedPadding.pad(data)
    dirty[dirty.count - 1] = 1
    refuses("padding refuses non-zero fill") { _ = try SealedPadding.unpad(dirty) }
    refuses("padding refuses a length past the end") { _ = try SealedPadding.unpad(Data([0, 0, 1, 0, 1])) }
}

func checkCanonical() {
    let value = SealedJson.object([
        "b": .int(2), "a": .array([.null, .bool(true), .string("q\"\\\n\u{1}é")]), "é": .int(-1)
    ])
    check(value.canonical == #"{"a":[null,true,"q\"\\\n\u0001é"],"b":2,"é":-1}"#, "canonical JSON")
    let parsed = try? SealedJson.parse(Data(#"{"z":[1,{"y":false}],"n":null}"#.utf8))
    check(parsed?.canonical == #"{"n":null,"z":[1,{"y":false}]}"#, "parsed JSON is canonical")
    refuses("canonical JSON refuses fractions") { _ = try SealedJson.parse(Data("1.5".utf8)) }
}

func checkDeviceKeys() {
    checkCanonical()
    let software = try! SealedDevice.create(enclave: false)
    checkDevice(software, "software")
    guard let enclave = try? SealedDevice.create(enclave: true) else {
        print("skip Secure Enclave keys: none here (unsigned binary or no enclave)")
        return
    }
    check(enclave.kem.isEnclave, "device keys are in the Secure Enclave")
    checkDevice(enclave, "Secure Enclave")
    let store = MemoryStore()
    try? SealedDeviceStore.save(enclave, to: store)
    let restored = try? SealedDeviceStore.load(from: store)
    check(restored?.kemPublic == enclave.kemPublic && restored?.signingPublic == enclave.signingPublic, "Secure Enclave keys restore from a blob")
    check(restored?.deviceId == enclave.deviceId, "restored device id")
    let entry = SealedChainEntry(seq: 0, prev: "", at: 1, body: .object(["type": .string("x")]))
    let signed = try? restored?.sign(entry)
    check(signed?.verify(signingPublic: enclave.signingPublic) == true, "restored enclave key signs")
}

func checkDevice(_ device: SealedDevice, _ label: String) {
    check(device.kemPublic.count == 65 && device.signingPublic.count == 65, "\(label) public keys are P-256 points")
    let entry = SealedChainEntry(seq: 0, prev: "", at: 1, body: .object(["type": .string("x")]))
    let signed = try? device.sign(entry)
    check(signed?.by == device.deviceId, "\(label) signature names its device")
    check(signed?.verify(signingPublic: device.signingPublic) == true, "\(label) chain signature verifies")
    check(signed?.verify(signingPublic: device.kemPublic) == false, "\(label) signature fails under another key")
    if #available(iOS 17.0, macOS 14.0, *) {
        let raw = SealedRawScopeKeys.make()
        let grant = try? SealedGrantCrypto.wrap(
            account: "a", raw: raw, deviceId: device.deviceId, recipientPublic: device.kemPublic)
        let opened = grant.flatMap { try? SealedGrantCrypto.open($0, with: device.kem) }
        check(opened?.dataKey == raw.dataKey && opened?.indexKey == raw.indexKey, "\(label) key opens its own HPKE grant")
    }
    let store = MemoryStore()
    if !device.kem.isEnclave {
        try? SealedDeviceStore.save(device, to: store)
        check((try? SealedDeviceStore.load(from: store))??.signingPublic == device.signingPublic, "\(label) keys restore")
    }
}
