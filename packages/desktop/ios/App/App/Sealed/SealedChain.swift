import Foundation

/// Verifies the device chain from genesis, exactly as packages/remote `sealedChain` does: each
/// entry in order, signed by an active device whose role may sign that type, and a pin from an
/// earlier verification must still be on the chain.
enum SealedChain {
    /// Which signer roles may append which entry types. Bots sign nothing.
    private static let signers: [String: [String]] = [
        "genesis": ["admin"], "enroll": ["admin", "recovery"], "revoke": ["admin"],
        "scope": ["admin"], "rotate": ["admin"]
    ]

    struct Expectation {
        let account: String
        let pin: SealedChainPin?
    }

    static func fail(_ message: String) -> SealedError {
        SealedError("Device chain refused: \(message)")
    }

    static func verify(
        _ entries: [SealedChainEntry], account: String, pin: SealedChainPin? = nil
    ) throws -> SealedChainState {
        let expectation = Expectation(account: account, pin: pin)
        var state: SealedChainState?
        for (index, entry) in entries.enumerated() {
            state = try step(state, entry, index: Int64(index), expectation)
        }
        guard let verified = state else { throw fail("chain is empty") }
        if let pin, verified.seq < pin.seq { throw fail("chain is older than the pin") }
        return verified
    }

    private static func step(
        _ state: SealedChainState?, _ entry: SealedChainEntry, index: Int64, _ expect: Expectation
    ) throws -> SealedChainState {
        guard entry.seq == index, entry.prev == (state?.head ?? "") else {
            throw fail("entry \(index) is out of order")
        }
        guard let type = entry.body["type"]?.text, signers[type] != nil else {
            throw fail("entry \(index) has an unknown type")
        }
        let key = try signerKey(state, entry, type: type)
        guard entry.verify(signingPublic: key) else { throw fail("entry \(index) has a bad signature") }
        var next: SealedChainState
        if type == "genesis" {
            next = try SealedChainState.genesis(entry, account: expect.account)
        } else if let state {
            next = state
            try next.apply(entry, type: type)
        } else { throw fail("chain has no genesis") }
        next.seq = index
        next.head = entry.hash
        if let pin = expect.pin, pin.seq == index, pin.head != next.head {
            throw fail("chain forked from the pin")
        }
        return next
    }

    private static func signerKey(
        _ state: SealedChainState?, _ entry: SealedChainEntry, type: String
    ) throws -> Data {
        let signer: SealedChainDevice?
        if type == "genesis" {
            let devices = try entry.body["devices"]?.items?.map { try SealedChainDevice(json: $0) }
            signer = devices?.first { $0.deviceId == entry.by }
        } else {
            signer = state?.devices[entry.by]
            if signer?.active != true { throw fail("signer is not an active device") }
        }
        guard let signer else { throw fail("signer is not an active device") }
        guard signers[type]?.contains(signer.role) == true else {
            throw fail("\(signer.role) cannot sign \(type)")
        }
        guard let key = RemoteCoding.data(base64url: signer.signingPublic) else {
            throw fail("signer key is malformed")
        }
        return key
    }
}
