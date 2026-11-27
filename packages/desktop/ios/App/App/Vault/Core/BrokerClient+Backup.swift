import Foundation

extension BrokerClient {
    private struct Download: Decodable { let blob: String }
    private struct Upload: Encodable { let recipientDeviceId: String; let blob: String }

    public func upload(_ blob: Data, recipientID: String, sign: Sign) async throws {
        guard blob.count <= VaultBackup.maxBlobSize else { throw BackupError.tooLarge }
        guard BrokerProtocol.validDeviceID(recipientID) else { throw BrokerError.invalidDevice }
        let payload = try JSONEncoder().encode(Upload(
            recipientDeviceId: recipientID, blob: BrokerProtocol.base64url(blob)
        ))
        let response: Acknowledgment = try await authenticated(.backupPut, payload: payload, sign: sign)
        guard response.ok else { throw BrokerError.malformedResponse }
    }

    public func download(sign: Sign) async throws -> Data {
        let result: Download = try await authenticated(.backupGet, payload: Data(), sign: sign)
        let blob = try BrokerProtocol.decode(result.blob)
        guard blob.count <= VaultBackup.maxBlobSize else { throw BackupError.tooLarge }
        return blob
    }
}
