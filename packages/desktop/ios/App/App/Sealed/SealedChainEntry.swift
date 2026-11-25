import CryptoKit
import Foundation

/// One signed entry of the device chain: `{seq, prev, at, by, body}` plus `sig`.
struct SealedChainEntry: Equatable {
    var seq: Int64
    var prev: String
    var at: Int64
    /// The signing device's id; `SealedDevice.sign` sets it.
    var by = ""
    var body: SealedJson
    var sig = ""

    init(seq: Int64, prev: String, at: Int64, body: SealedJson) {
        (self.seq, self.prev, self.at, self.body) = (seq, prev, at, body)
    }

    /// Reads the JSON the server stores (and TypeScript writes).
    init(json: SealedJson) throws {
        guard let seq = json["seq"]?.number, let prev = json["prev"]?.text,
            let at = json["at"]?.number, let by = json["by"]?.text, let body = json["body"],
            let sig = json["sig"]?.text
        else { throw SealedError("Chain entry is malformed.") }
        self.init(seq: seq, prev: prev, at: at, body: body)
        (self.by, self.sig) = (by, sig)
    }

    private var fields: [String: SealedJson] {
        ["seq": .int(seq), "prev": .string(prev), "at": .int(at), "by": .string(by), "body": body]
    }

    /// The signed bytes: label ‖ canonical {at, body, by, prev, seq}.
    var signedBytes: Data {
        SealedBytes.text("harness/sealed/v1/chain\0" + SealedJson.object(fields).canonical)
    }

    var json: SealedJson {
        var all = fields
        all["sig"] = .string(sig)
        return .object(all)
    }

    /// Hex SHA-256 of the canonical signed entry; the next entry's `prev`.
    var hash: String { RemoteCoding.hex(SealedBytes.sha256(SealedBytes.text(json.canonical))) }

    /// True when `sig` is a valid raw `r‖s` ECDSA P-256 signature by this uncompressed public key.
    func verify(signingPublic: Data) -> Bool {
        guard let raw = RemoteCoding.data(base64url: sig), raw.count == 64,
            let key = try? P256.Signing.PublicKey(x963Representation: signingPublic),
            let signature = try? P256.Signing.ECDSASignature(rawRepresentation: raw)
        else { return false }
        return key.isValidSignature(signature, for: signedBytes)
    }
}
