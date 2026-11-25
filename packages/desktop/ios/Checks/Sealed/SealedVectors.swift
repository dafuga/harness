import CryptoKit
import Foundation

/// The frozen vectors, read once. Every value was made by node:crypto or @hpke/core, never by
/// the code under check.
struct SealedVectors {
    let root: [String: Any]

    func part(_ name: String) -> [String: Any] { root[name] as? [String: Any] ?? [:] }
    func text(_ name: String, _ key: String) -> String { part(name)[key] as? String ?? "" }
    func bytes(_ name: String, _ key: String) -> Data {
        RemoteCoding.data(base64url: text(name, key)) ?? Data()
    }

    var scopeKeys: SealedScopeKeys {
        let epoch = UInt32(part("scope")["epoch"] as? Int ?? 0)
        let raw = SealedRawScopeKeys(
            scopeId: bytes("scope", "scopeId"), epoch: epoch, dataKey: bytes("scope", "dataKey"),
            indexKey: bytes("scope", "indexKey"))
        return try! SealedScopeKeys(raw)
    }

    func checkKeysAndRecords() {
        let keys = scopeKeys
        check(keys.commitment == bytes("scope", "commitment"), "scope commitment")
        check(keys.name == text("scope", "scopeId"), "scope name")
        let id = try? keys.objectId(kind: "item", localId: "fx4c15")
        check(id == bytes("objectId", "id"), "opaque object id")
        let envelope = bytes("record", "envelope")
        let revision = UInt64(text("record", "revision")) ?? 0
        let opened = try? SealedRecord.open(envelope, keys: keys)
        let value = opened.flatMap { try? SealedJson.parse($0.json) }
        let expected = part("record")["value"].flatMap { try? SealedJson.from($0) }
        check(value != nil && value == expected, "record opens to the vector value")
        check(opened?.header.revision == revision, "record header revision")
        let json = Data(#"{"kind":"item","title":"Sealed vector","status":"open"}"#.utf8)
        let sealed = try? SealedRecord.seal(
            json, keys: keys, object: SealedObjectRef(objectId: id ?? Data(), revision: revision),
            random: SealedRecordRandom(
                salt: Data((0..<16).map { UInt8(0xc0 + $0) }),
                nonce: Data((0..<12).map { UInt8(0xd0 + $0) })))
        check(sealed == envelope, "record seals to the vector bytes")
        checkRecordTampering(envelope, keys)
    }

    private func checkRecordTampering(_ envelope: Data, _ keys: SealedScopeKeys) {
        for index in [0, 5, 25, 60, 70, 90, envelope.count - 1] {
            var changed = envelope
            changed[index] ^= 1
            refuses("record refuses a changed byte at \(index)") { _ = try SealedRecord.open(changed, keys: keys) }
        }
        let other = try! SealedScopeKeys(SealedRawScopeKeys.make())
        refuses("record refuses other keys") { _ = try SealedRecord.open(envelope, keys: other) }
        let next = try! SealedScopeKeys(SealedRawScopeKeys.make(rotating: keys.raw))
        refuses("record refuses a newer epoch") { _ = try SealedRecord.open(envelope, keys: next) }
        refuses("record refuses a short envelope") { _ = try SealedRecord.open(envelope.prefix(40), keys: keys) }
    }

    func checkFramesAndEnrollment() {
        let keys = scopeKeys
        let streamId = bytes("frame", "streamId")
        let counter = UInt64(text("frame", "counter")) ?? 0
        let stream = try! SealedStream(keys: keys, id: streamId)
        let frame = bytes("frame", "envelope")
        let opened = try? SealedFrame.open(frame, keys: keys, stream: stream)
        check(opened.flatMap { String(data: $0.data, encoding: .utf8) } == text("frame", "text"), "frame opens")
        check(opened?.header.counter == counter && opened?.header.streamId == streamId, "frame header")
        let sealed = try? SealedFrame.seal(
            Data(text("frame", "text").utf8), keys: keys, stream: stream, counter: counter)
        check(sealed == frame, "frame seals to the vector bytes")
        var moved = frame
        moved[40] ^= 1
        refuses("frame refuses a moved counter") { _ = try SealedFrame.open(moved, keys: keys, stream: stream) }
        let elsewhere = try! SealedStream(keys: keys, id: Data(count: 16))
        refuses("frame refuses another stream key") { _ = try SealedFrame.open(frame, keys: keys, stream: elsewhere) }
        checkEnrollment()
    }

    private func checkEnrollment() {
        let request = SealedEnrollKeys(
            kemPublic: bytes("enroll", "kemPublic"), signingPublic: bytes("enroll", "signingPublic"))
        let nonce = bytes("enroll", "requestNonce")
        let commit = try? SealedEnroll.commit(request, nonce: nonce)
        check(commit == text("enroll", "commit"), "enrollment commitment")
        check(SealedEnroll.checkCommit(request, nonce: nonce, commitment: text("enroll", "commit")), "commitment opens")
        check(!SealedEnroll.checkCommit(request, nonce: bytes("enroll", "approverNonce"), commitment: text("enroll", "commit")), "wrong nonce does not open it")
        let code = try? SealedEnroll.code(
            request: request, requestNonce: nonce, approverSigningPublic: bytes("enroll", "approverSigningPublic"),
            approverNonce: bytes("enroll", "approverNonce"))
        check(code == text("enroll", "sas"), "6-digit code")
    }

    func checkChainEntryAndGrant() {
        let part = part("chainEntry")
        let entry = (try? SealedJson.from(part["entry"] ?? [:])).flatMap { try? SealedChainEntry(json: $0) }
        let publicKey = bytes("chainEntry", "signingPublic")
        check(entry?.verify(signingPublic: publicKey) == true, "node-signed chain entry verifies")
        check(entry?.hash == text("chainEntry", "hash"), "chain entry hash")
        var forged = entry
        forged?.at = 2
        check(forged?.verify(signingPublic: publicKey) == false, "changed chain entry fails")
        check(entry?.verify(signingPublic: bytes("enroll", "kemPublic")) == false, "other key fails")
        if #available(iOS 17.0, macOS 14.0, *) { checkGrant() }
    }

    @available(iOS 17.0, macOS 14.0, *)
    private func checkGrant() {
        let grant = SealedGrant(
            account: text("grant", "account"), scope: text("grant", "scope"),
            epoch: UInt32(part("grant")["epoch"] as? Int ?? 0), device: text("grant", "device"),
            enc: text("grant", "enc"), ct: text("grant", "ct"))
        let kem = SealedKem.software(
            try! P256.KeyAgreement.PrivateKey(rawRepresentation: bytes("grant", "recipientD")))
        check(kem.publicKey == bytes("grant", "recipientPublic"), "grant recipient key")
        let raw = try? SealedGrantCrypto.open(grant, with: kem)
        check(raw?.dataKey == bytes("scope", "dataKey") && raw?.indexKey == bytes("scope", "indexKey"), "HPKE grant from @hpke/core opens")
        let other = SealedKem.software(P256.KeyAgreement.PrivateKey())
        refuses("grant refuses another device key") { _ = try SealedGrantCrypto.open(grant, with: other) }
        let moved = SealedGrant(account: grant.account, scope: grant.scope, epoch: grant.epoch, device: "device-other", enc: grant.enc, ct: grant.ct)
        refuses("grant refuses another recipient id") { _ = try SealedGrantCrypto.open(moved, with: kem) }
    }
}
