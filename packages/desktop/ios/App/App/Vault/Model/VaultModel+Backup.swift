import CryptoKit
import Foundation

struct BackupReference: Identifiable {
    let deviceID: String
    let fingerprint: String
    var id: String { deviceID }
}

extension VaultModel {
    func recoveryKeys(for connection: BrokerConnection) async -> PublicEnrollment? {
        var enrollment: PublicEnrollment?
        await perform {
            guard isCurrent(connection) else { throw DeviceVaultError.invalidConfiguration }
            let configuration = connection.configuration
            try configuration.validate()
            let context = try await authenticate("Show this device’s public recovery keys")
            defer { context.invalidate() }
            let signing = try keys.signingKey(for: connection, create: true).publicKey.x963Representation
            let recovery = try keys.agreementPublicKey(.backup, context: context, create: true, at: connection).x963Representation
            enrollment = PublicEnrollment(
                machine: connection.machine,
                signingKey: BrokerProtocol.base64url(signing), recoveryKey: BrokerProtocol.base64url(recovery),
                signingFingerprint: BrokerProtocol.fingerprint(signing),
                recoveryFingerprint: BrokerProtocol.fingerprint(recovery)
            )
        }
        return enrollment
    }

    func exportBackup(to peer: RecoveryPeer?, at connection: BrokerConnection) async -> [BackupReference] {
        var uploaded: [BackupReference] = []
        await perform {
            let settings = connection.configuration
            guard settings.role == .approver else { throw DeviceVaultError.invalidConfiguration }
            let api = try client(for: connection)
            let sign = signer(for: connection)
            let context = try await authenticate("Encrypt a backup of this vault")
            defer { context.invalidate() }
            let recipient = try keys.agreementPublicKey(.backup, context: context, create: false, at: connection)
            var recipients = [VaultBackup.Recipient(id: settings.deviceID, key: recipient)]
            if let peer {
                guard peer.deviceID != settings.deviceID else { throw DeviceVaultError.invalidConfiguration }
                let key = try P256.KeyAgreement.PublicKey(x963Representation: peer.verifiedKey())
                guard key.x963Representation != recipient.x963Representation else {
                    throw DeviceVaultError.invalidConfiguration
                }
                recipients.append(.init(id: peer.deviceID, key: key))
            }
            let entries = try vault.export(context: context)
            let timestamp = try reserveBackupTimestamp()
            let backups = try recipients.map { recipient in
                (recipient.id, try VaultBackup.seal(
                    entries, from: .init(senderID: settings.deviceID, createdAt: timestamp),
                    to: recipient, sign: sign
                ))
            }
            for (id, blob) in backups {
                try await api.upload(blob, recipientID: id, sign: sign)
                uploaded.append(.init(deviceID: id, fingerprint: BrokerProtocol.fingerprint(blob)))
            }
        }
        return uploaded
    }

    func restoreBackup(from peer: RecoveryPeer, fingerprint: String, at connection: BrokerConnection) async -> Bool {
        await perform {
            let settings = connection.configuration
            let api = try client(for: connection)
            let sign = signer(for: connection)
            let context = try await authenticate("Restore this verified backup")
            defer { context.invalidate() }
            let senderID: String
            let verifier: P256.Signing.PublicKey
            if settings.role == .approver {
                senderID = settings.deviceID
                verifier = try keys.signingKey(for: connection).publicKey
            } else {
                senderID = peer.deviceID
                verifier = try P256.Signing.PublicKey(x963Representation: peer.verifiedKey())
            }
            let backupKey = try keys.agreement(.backup, context: context, at: connection)
            let previous = try vault.previousRestore(from: senderID)
            let trust = VaultBackup.Trust(
                senderID: senderID, key: verifier,
                expectedFingerprint: fingerprint.isEmpty ? nil : fingerprint, previous: previous
            )
            let blob = try await api.download(sign: sign)
            let reader = VaultBackup.Reader(recipientID: settings.deviceID, now: Self.timestamp)
            let opened = try VaultBackup.open(blob, as: reader, trust: trust) {
                try backupKey.sharedSecretFromKeyAgreement(with: $0)
            }
            try vault.restore(opened.entries, receipt: opened.receipt, source: senderID, context: context)
            try loadEntries()
        }
    }

    private func reserveBackupTimestamp() throws -> Int64 {
        let previous = try keychain.read("backup-generation")
            .map { try JSONDecoder().decode(Int64.self, from: $0) } ?? 0
        let next = max(Self.timestamp, previous + 1)
        try keychain.write(JSONEncoder().encode(next), to: "backup-generation")
        return next
    }

    private static var timestamp: Int64 { Int64(Date().timeIntervalSince1970 * 1_000) }
}
