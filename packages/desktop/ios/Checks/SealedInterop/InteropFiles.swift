import Foundation

/// The files the two halves pass to each other. All of it is test data in a temporary folder.
struct InteropFiles {
    let folder: URL

    func read(_ name: String) throws -> SealedJson {
        try SealedJson.parse(Data(contentsOf: folder.appendingPathComponent(name)))
    }

    func write(_ name: String, _ value: SealedJson) throws {
        try Data(value.canonical.utf8).write(to: folder.appendingPathComponent(name))
    }

    func text(_ json: SealedJson, _ key: String) throws -> String {
        guard let value = json[key]?.text else { throw SealedError("Interop file lacks \(key).") }
        return value
    }

    func bytes(_ json: SealedJson, _ key: String) throws -> Data {
        guard let data = RemoteCoding.data(base64url: try text(json, key)) else {
            throw SealedError("Interop file has bad base64 in \(key).")
        }
        return data
    }

    func raw(_ json: SealedJson) throws -> SealedRawScopeKeys {
        SealedRawScopeKeys(
            scopeId: try bytes(json, "scopeId"), epoch: UInt32(json["epoch"]?.number ?? 0),
            dataKey: try bytes(json, "dataKey"), indexKey: try bytes(json, "indexKey"))
    }

    /// A device file written by TypeScript, given a chain role and scopes.
    func chainDevice(_ file: SealedJson, role: String, scopes: [String]) throws -> SealedJson {
        guard case .object(var fields) = file else { throw SealedError("Device file is malformed.") }
        fields["role"] = .string(role)
        fields["scopes"] = .array(scopes.map { .string($0) })
        return .object(fields)
    }

    func entries(_ json: SealedJson) throws -> [SealedChainEntry] {
        try (json.items ?? []).map { try SealedChainEntry(json: $0) }
    }
}
