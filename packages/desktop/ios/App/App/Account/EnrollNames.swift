import Foundation

extension EnrollHub {
    /// The first genesis scope is the account scope. Neither the URL nor body contains the
    /// display name in plaintext.
    func writeName(_ name: String, device: String, keys: SealedScopeKeys) async throws {
        let id = try keys.objectId(kind: "device-name", localId: device)
        let json = SealedJson.object(["kind": .string("device-name"), "name": .string(name)])
        let revision = UInt64(Date().timeIntervalSince1970 * 1000)
        let envelope = try SealedRecord.seal(Data(json.canonical.utf8), keys: keys,
            object: SealedObjectRef(objectId: id, revision: revision))
        let answer = try await send(.object(keys.name, RemoteCoding.base64url(id)), as: device,
                                    method: "PUT", body: Data(RemoteCoding.base64url(envelope).utf8))
        guard answer.status == 200 || answer.status == 201 else { throw HubAccountFailure.hub(answer) }
    }
}
