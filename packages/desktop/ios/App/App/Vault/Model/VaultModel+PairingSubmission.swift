import Foundation
import CryptoKit
import LocalAuthentication

@available(iOS 17.0, *)
extension VaultModel {
    func pairingSubmission(
        for exchange: PairingExchange, at connection: BrokerConnection,
        signing: SecureEnclave.P256.Signing.PrivateKey, context: LAContext
    ) throws -> PairingSubmission {
        let recovery = try keys.agreementPublicKey(.backup, context: context, create: true, at: connection)
        let imports = try keys.agreementPublicKey(.passwordImport, context: context, create: true, at: connection)
        let enrollment = PairingEnrollment(
            deviceId: connection.configuration.deviceID,
            signingKey: BrokerProtocol.base64url(signing.publicKey.x963Representation),
            importKey: BrokerProtocol.base64url(imports.x963Representation),
            recoveryKey: BrokerProtocol.base64url(recovery.x963Representation)
        )
        return try exchange.seal(enrollment)
    }

    func activatePairing(
        _ connection: BrokerConnection, with submission: PairingSubmission,
        for exchange: PairingExchange, over relay: PairingRelay
    ) async throws {
        do {
            try await relay.client.submitPairing(submission, for: exchange)
        } catch let error {
            try Task.checkCancellation()
            switch error {
            case is URLError, is DecodingError, BrokerError.transport, BrokerError.serverUnreachable,
                 BrokerError.malformedResponse, BrokerError.http(500...599):
                // A lost response may follow a successful submission. Check the pin before asking for another QR.
                try await verifyPairedPin(over: relay)
                try storePairedConnection(connection)
                connection.retryPoll()
                return
            default:
                throw error
            }
        }
        // Keep the phone identity after the relay accepts the sealed enrollment.
        try storePairedConnection(connection)
        try await verifyPairedPin(over: relay)
        connection.retryPoll()
    }


    private func verifyPairedPin(over relay: PairingRelay) async throws {
        // The CLI installs the pin after receiving and opening the sealed enrollment.
        for attempt in 0..<5 {
            do {
                try await relay.client.verifyEnrollment(sign: relay.sign)
                return
            } catch BrokerError.http(401...403) where attempt < 4 {
                try await Task.sleep(for: .seconds(1))
            } catch {
                try Task.checkCancellation()
                throw PairingError.activationUnconfirmed
            }
        }
    }

    struct PairingRelay {
        let client: BrokerClient
        let sign: BrokerClient.Sign
    }
}
