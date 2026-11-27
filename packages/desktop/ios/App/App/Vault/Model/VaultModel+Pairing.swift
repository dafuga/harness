import CryptoKit
import Foundation
import LocalAuthentication

@available(iOS 17.0, *)
extension VaultModel {
    func pairingMachine(for offer: PairingOffer) -> BrokerMachine {
        if let known = connections.first(where: { $0.configuration.origin == offer.origin }) {
            return known.machine
        }
        return .paired(title: URL(string: offer.origin)?.host ?? offer.origin, origin: offer.origin)
    }

    func pair(_ offer: PairingOffer) async throws {
        guard !workInProgress else { throw CancellationError() }
        workInProgress = true
        defer { workInProgress = false }

        try offer.checkExpiry()
        let connection = try pairingConnection(for: offer)
        let context = try await pairingContext(for: connection)
        defer { context.invalidate() }
        try Task.checkCancellation()
        try offer.checkExpiry()

        let exchange = try PairingExchange(offer: offer)

        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--pairing-fixture"), fixtureSign != nil {
            try PairingFixture.submit(exchange)
            return
        }
        #endif

        let client = try BrokerClient(origin: offer.origin, deviceID: connection.configuration.deviceID)
        let signing = try keys.signingKey(for: connection, create: true)
        let submission = try pairingSubmission(for: exchange, at: connection, signing: signing, context: context)
        try Task.checkCancellation()
        let sign: BrokerClient.Sign = { try signing.signature(for: $0).rawRepresentation }
        try await activatePairing(connection, with: submission, for: exchange, over: .init(client: client, sign: sign))
    }

    private func pairingContext(for connection: BrokerConnection) async throws -> LAContext {
        do {
            return try await authenticate("Pair Harness Vault with \(connection.machine.title)")
        } catch let failure as LAError where [.userCancel, .systemCancel, .appCancel].contains(failure.code) {
            throw CancellationError()
        }
    }

    private func pairingConnection(for offer: PairingOffer) throws -> BrokerConnection {
        let current = connections.first { $0.configuration.origin == offer.origin }
        let machine = pairingMachine(for: offer)
        let configuration: BrokerConfiguration
        if let current {
            configuration = current.configuration
        } else {
            let endpoint = BrokerMachine.endpoint(of: offer.origin)
            guard !connections.contains(where: { BrokerMachine.endpoint(of: $0.configuration.origin) == endpoint }) else {
                throw DeviceVaultError.duplicateBroker
            }
            let digest = BrokerProtocol.fingerprint(Data(offer.origin.utf8))
            let id = "harness-iphone-\(digest.prefix(12))"
            guard !connections.contains(where: { $0.configuration.deviceID == id }) else {
                throw DeviceVaultError.duplicateBrokerDevice
            }
            configuration = BrokerConfiguration(origin: offer.origin, deviceID: id)
        }
        try configuration.validate()
        guard configuration.role == .approver else { throw PairingError.invalidEnrollment }
        return BrokerConnection(machine: machine, stored: .init(configuration: configuration))
    }
}
