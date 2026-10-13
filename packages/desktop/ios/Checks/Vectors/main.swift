import CryptoKit
import Foundation

// Known-answer check of the Swift secure channel against the frozen vectors of the backend
// (packages/remote/test/support/secure-vectors.json). Compiled for macOS together with
// RemoteCoding.swift and RemoteCrypto.swift by scripts/check-ios-vectors.ts; not part of the app. The rules of a session are in ../Native.

var failures = 0
func check(_ passed: Bool, _ name: String) {
    print("\(passed ? "ok  " : "FAIL") \(name)")
    if !passed { failures += 1 }
}
func text(_ object: [String: Any], _ key: String) -> String {
    object[key] as? String ?? ""
}
func bytes(_ object: [String: Any], _ key: String) -> Data {
    RemoteCoding.data(base64url: text(object, key)) ?? Data()
}
func pair(_ value: Any?) -> (P256.KeyAgreement.PrivateKey, Data) {
    let object = value as? [String: Any] ?? [:]
    let key = try? P256.KeyAgreement.PrivateKey(rawRepresentation: bytes(object, "d"))
    return (key ?? P256.KeyAgreement.PrivateKey(), bytes(object, "publicKey"))
}

guard CommandLine.arguments.count > 1,
    let file = try? Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])),
    let root = RemoteCoding.object(file)
else {
    print("FAIL the vectors could not be read")
    exit(2)
}

let (hostStatic, hostKey) = pair(root["hostStatic"])
let (deviceStatic, deviceKey) = pair(root["deviceStatic"])
let (hostEphemeral, hostEphemeralKey) = pair(root["hostEphemeral"])
let (deviceEphemeral, deviceEphemeralKey) = pair(root["deviceEphemeral"])
check(hostStatic.publicKey.x963Representation == hostKey, "host public key is the X9.63 point")
check(deviceStatic.publicKey.x963Representation == deviceKey, "device public key is the X9.63 point")
check(hostEphemeral.publicKey.x963Representation == hostEphemeralKey, "host ephemeral key")
check(deviceEphemeral.publicKey.x963Representation == deviceEphemeralKey, "device ephemeral key")
check(RemoteCoding.identity(of: hostKey) == text(root, "hostId"), "hostId is the hash of the host key")
check(RemoteCoding.identity(of: deviceKey) == text(root, "deviceId"), "deviceId is the hash of the device key")

let session = root["session"] as? [String: Any] ?? [:]
let keys = try? RemoteCrypto.sessionKeys(RemoteHandshake(
    hostId: text(root, "hostId"), deviceId: text(root, "deviceId"), generation: root["generation"] as? Int ?? -1,
    deviceStatic: deviceStatic, deviceEphemeral: deviceEphemeral, hostStaticKey: hostKey,
    hostEphemeralKey: hostEphemeralKey, deviceNonce: bytes(root, "deviceNonce"), hostNonce: bytes(root, "hostNonce")))
func hex(_ key: SymmetricKey?) -> String {
    key.map { RemoteCoding.hex($0.withUnsafeBytes { Data($0) }) } ?? ""
}
check(hex(keys?.d2h) == text(session, "d2h"), "session key device to host")
check(hex(keys?.h2d) == text(session, "h2d"), "session key host to device")

for (index, item) in (session["packets"] as? [[String: Any]] ?? []).enumerated() {
    let direction = text(item, "direction")
    let counter = UInt64(item["counter"] as? Int ?? 0)
    let more = item["more"] as? Bool ?? false
    let plain = Data(text(item, "plaintext").utf8)
    guard let key = direction == "d2h" ? keys?.d2h : keys?.h2d else { continue }
    let context = RemotePacketContext(direction: direction, counter: counter, more: more)
    let sealed = try? RemoteCrypto.seal(plain, key: key, context: context)
    check(sealed == text(item, "data"), "packet \(index) \(direction) seals to the vector")
    let opened = try? RemoteCrypto.open(text(item, "data"), key: key, context: context)
    check(opened == plain, "packet \(index) \(direction) opens to the plaintext")
    let later = RemotePacketContext(direction: direction, counter: counter + 1, more: more)
    let moved = try? RemoteCrypto.open(text(item, "data"), key: key, context: later)
    check(moved == nil, "packet \(index) is refused under another counter")
}
check((session["packets"] as? [Any] ?? []).count > 0, "the vectors hold packets")

let pairing = root["pairing"] as? [String: Any] ?? [:]
let (pairingEphemeral, _) = pair(pairing["ephemeral"])
let pairingKeys = try? RemoteCrypto.pairingKeys(
    ephemeral: pairingEphemeral, hostKey: hostKey, hostId: text(root, "hostId"),
    pairingId: text(pairing, "pairingId"))
let request = pairingKeys.flatMap { try? RemoteCrypto.sealRequest(Data(text(pairing, "requestPlain").utf8), key: $0.request) }
check(request == text(pairing, "requestSealed"), "pairing request seals to the vector")
let approval = pairingKeys.flatMap { try? RemoteCrypto.openApproval(text(pairing, "approvalSealed"), key: $0.approval) }
check(approval == Data(text(pairing, "approvalPlain").utf8), "pairing approval opens to the plaintext")

if CommandLine.arguments.count > 2 { offerVectors(CommandLine.arguments[2]) } else { check(false, "no offer vectors were given") }

print(failures == 0 ? "All vectors reproduced." : "\(failures) vector checks failed.")
exit(failures == 0 ? 0 : 1)
