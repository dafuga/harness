import CryptoKit
import Foundation

/// A chain built and signed by Swift, then judged by Swift. TypeScript's chain code is held to
/// the same rules by its own tests; the vectors above prove the signed bytes agree.
struct ChainFixture {
    let admin = try! SealedDevice.create(enclave: false)
    let recovery = try! SealedDevice.create(enclave: false)
    let bot = try! SealedDevice.create(enclave: false)
    let phone = try! SealedDevice.create(enclave: false)
    let account = SealedRawScopeKeys.make()
    var entries: [SealedChainEntry] = []

    func device(_ keys: SealedDevice, _ role: String, _ scopes: [String]) -> SealedJson {
        SealedChainDevice(keys, role: role, scopes: scopes).json
    }

    func commitment(_ raw: SealedRawScopeKeys) -> SealedJson {
        try! SealedScopeCommitment(raw).json
    }

    mutating func append(_ signer: SealedDevice, _ body: SealedJson) {
        let prev = entries.last?.hash ?? ""
        entries.append(try! signer.sign(SealedChainEntry(
            seq: Int64(entries.count), prev: prev, at: Int64(entries.count + 1), body: body)))
    }

    static func genesis() -> ChainFixture {
        var fixture = ChainFixture()
        let scope = RemoteCoding.base64url(fixture.account.scopeId)
        fixture.append(fixture.admin, .object([
            "type": .string("genesis"), "account": .string("acct"),
            "devices": .array([fixture.device(fixture.admin, "admin", [scope]), fixture.device(fixture.recovery, "recovery", [scope])]),
            "scopes": .array([fixture.commitment(fixture.account)])
        ]))
        return fixture
    }
}

func checkChainRules() {
    var fixture = ChainFixture.genesis()
    let scope = RemoteCoding.base64url(fixture.account.scopeId)
    fixture.append(fixture.admin, .object(["type": .string("enroll"), "device": fixture.device(fixture.phone, "admin", [scope])]))
    fixture.append(fixture.recovery, .object(["type": .string("enroll"), "device": fixture.device(fixture.bot, "bot", [scope])]))
    let state = try? SealedChain.verify(fixture.entries, account: "acct")
    check(state?.seq == 2 && state?.devices.count == 4, "a signed chain verifies")
    check(state?.devices[fixture.bot.deviceId]?.role == "bot", "the recovery device may enroll")
    checkChainRefusals(fixture)
    if #available(iOS 17.0, macOS 14.0, *), let state { checkChainGrants(fixture, state) }
    checkRevokeAndRotate(fixture)
}

func checkChainRefusals(_ fixture: ChainFixture) {
    let entries = fixture.entries
    refuses("chain refuses another account") { _ = try SealedChain.verify(entries, account: "other") }
    refuses("chain refuses an empty list") { _ = try SealedChain.verify([], account: "acct") }
    refuses("chain refuses a missing genesis") { _ = try SealedChain.verify(Array(entries.dropFirst()), account: "acct") }
    refuses("chain refuses a reordered list") { _ = try SealedChain.verify([entries[0], entries[2], entries[1]], account: "acct") }
    var changed = entries
    changed[1].at += 1
    refuses("chain refuses a changed entry") { _ = try SealedChain.verify(changed, account: "acct") }
    var forged = fixture
    forged.append(fixture.bot, .object(["type": .string("revoke"), "device": .string(fixture.phone.deviceId)]))
    refuses("chain refuses a bot signer") { _ = try SealedChain.verify(forged.entries, account: "acct") }
    var recoverySigns = fixture
    recoverySigns.append(fixture.recovery, .object(["type": .string("revoke"), "device": .string(fixture.phone.deviceId)]))
    refuses("chain refuses a recovery revoke") { _ = try SealedChain.verify(recoverySigns.entries, account: "acct") }
    let pin = SealedChainPin(seq: 1, head: "00")
    refuses("chain refuses a fork from the pin") { _ = try SealedChain.verify(entries, account: "acct", pin: pin) }
    let rolled = SealedChainPin(seq: 5, head: "00")
    refuses("chain refuses a rollback below the pin") { _ = try SealedChain.verify(entries, account: "acct", pin: rolled) }
    check((try? SealedChain.verify(entries, account: "acct", pin: SealedChainPin(seq: 1, head: entries[1].hash))) != nil, "chain accepts its own pin")
}

@available(iOS 17.0, macOS 14.0, *)
func checkChainGrants(_ fixture: ChainFixture, _ state: SealedChainState) {
    let raw = fixture.account
    func grant(for device: SealedDevice, _ keys: SealedRawScopeKeys) -> SealedGrant {
        try! SealedGrantCrypto.wrap(account: "acct", raw: keys, deviceId: device.deviceId, recipientPublic: device.kemPublic)
    }
    let good = grant(for: fixture.phone, raw)
    let keys = try? state.openGrant(good, as: fixture.phone)
    check(keys?.commitment == (try? raw.commitment()), "a grant that matches the chain opens")
    let rogue = SealedRawScopeKeys(scopeId: raw.scopeId, epoch: 0, dataKey: RemoteCoding.random(32), indexKey: raw.indexKey)
    refuses("a grant with keys the chain does not commit to is refused") {
        _ = try state.openGrant(grant(for: fixture.phone, rogue), as: fixture.phone)
    }
    refuses("a grant for another device is refused") { _ = try state.openGrant(good, as: fixture.bot) }
    let unknown = SealedRawScopeKeys.make()
    refuses("a grant for a scope the chain lacks is refused") {
        _ = try state.openGrant(grant(for: fixture.phone, unknown), as: fixture.phone)
    }
}

func checkRevokeAndRotate(_ fixture: ChainFixture) {
    var next = fixture
    next.append(fixture.admin, .object(["type": .string("revoke"), "device": .string(fixture.phone.deviceId)]))
    let revoked = try? SealedChain.verify(next.entries, account: "acct")
    let scope = RemoteCoding.base64url(fixture.account.scopeId)
    check(revoked?.devices[fixture.phone.deviceId]?.active == false, "revoke marks the device inactive")
    check(revoked?.scopes[scope]?.stale == true, "revoke marks its scopes stale")
    let rotated = SealedRawScopeKeys.make(rotating: fixture.account)
    next.append(fixture.admin, .object(["type": .string("rotate"), "commitment": fixture.commitment(rotated)]))
    let after = try? SealedChain.verify(next.entries, account: "acct")
    check(after?.scopes[scope]?.epoch == 1 && after?.scopes[scope]?.stale == false, "rotate clears the stale flag")
    refuses("a revoked device cannot sign") {
        var again = next
        again.append(fixture.phone, .object(["type": .string("revoke"), "device": .string(fixture.bot.deviceId)]))
        _ = try SealedChain.verify(again.entries, account: "acct")
    }
    var skipped = next
    skipped.append(fixture.admin, .object(["type": .string("rotate"), "commitment": fixture.commitment(SealedRawScopeKeys.make(rotating: rotated.epoch == 1 ? SealedRawScopeKeys(scopeId: rotated.scopeId, epoch: 2, dataKey: rotated.dataKey, indexKey: rotated.indexKey) : rotated))]))
    refuses("rotation cannot skip an epoch") { _ = try SealedChain.verify(skipped.entries, account: "acct") }
}
