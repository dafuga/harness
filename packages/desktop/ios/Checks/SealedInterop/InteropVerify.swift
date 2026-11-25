import Foundation

/// Phase 2: Swift, with the same Secure Enclave keys, accepts what TypeScript made.
@available(iOS 17.0, macOS 14.0, *)
struct InteropVerify {
    let folder: URL
    var files: InteropFiles { InteropFiles(folder: folder) }

    func run() throws {
        guard let phone = try SealedDeviceStore.load(from: FileStore(folder: folder)) else {
            throw SealedError("The device blob is missing.")
        }
        let out = try files.read("ts-out.json")
        let chain = try files.entries(out["chain"] ?? .null)
        let state = try SealedChain.verify(chain, account: "interop")
        check(state.seq == 0 && state.devices[phone.deviceId]?.active == true, "TypeScript chain verifies in Swift")
        let grantJson = out["grant"] ?? .null
        let grant = SealedGrant(
            account: try files.text(grantJson, "account"), scope: try files.text(grantJson, "scope"),
            epoch: UInt32(grantJson["epoch"]?.number ?? 0), device: try files.text(grantJson, "device"),
            enc: try files.text(grantJson, "enc"), ct: try files.text(grantJson, "ct"))
        let keys = try state.openGrant(grant, as: phone)
        check(true, "\(phone.kem.isEnclave ? "Secure Enclave" : "software") key opens a TypeScript HPKE grant")
        let record = try SealedRecord.open(try files.bytes(out, "record"), keys: keys)
        let value = try SealedJson.parse(record.json)
        check(value["title"]?.text == "from typescript" && record.header.revision == 5, "TypeScript record opens")
        let stream = try SealedStream(keys: keys, id: try files.bytes(out, "streamId"))
        let frame = try SealedFrame.open(try files.bytes(out, "frame"), keys: keys, stream: stream)
        check(String(data: frame.data, encoding: .utf8) == "typescript frame" && frame.header.counter == 9, "TypeScript frame opens")
        let secret = try files.bytes(out, "recoverySecret")
        let recovery = try SealedRecovery.open(try files.text(out, "recovery"), secret: secret)
        check(recovery.deviceId == (try files.text(out, "recoveryDevice")), "TypeScript recovery blob opens")
        check(RemoteCoding.base64url(recovery.signingPublic) == (try files.text(out, "recoverySigning")), "recovery keys match")
        refuses(secret)
    }

    private func refuses(_ secret: Data) {
        let bad = SealedRecovery.newSecret()
        let blob = (try? files.read("ts-out.json")).flatMap { $0["recovery"]?.text } ?? ""
        let opened = try? SealedRecovery.open(blob, secret: bad)
        check(opened == nil, "a wrong recovery secret does not open it")
    }
}
