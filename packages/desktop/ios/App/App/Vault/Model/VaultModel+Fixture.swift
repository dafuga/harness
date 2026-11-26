import LocalAuthentication

extension VaultModel {
    static func make() -> VaultModel {
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--vault-ui-test") {
            return fixture()
        }
        #endif
        return VaultModel()
    }
}

#if DEBUG && targetEnvironment(simulator)
import CryptoKit
import Foundation

extension VaultModel {
    private static func fixture() -> VaultModel {
        let arguments = ProcessInfo.processInfo.arguments
        let origin = ProcessInfo.processInfo.environment["VAULT_FIXTURE_ORIGIN"] ?? "https://broker.example"
        let box = BrokerConnection(machine: .paired(title: "Grok Box", origin: origin), stored: .init(configuration: .init(origin: origin)),
                                   fixture: FixtureBroker(origin: origin))
        var connections = [box]
        if arguments.contains("--two-brokers") {
            let macOrigin = "https://mac.broker.example"
            let mac = BrokerConnection(machine: .paired(title: "Primary Mac", origin: macOrigin), stored: .init(
                configuration: .init(origin: macOrigin)),
                fixture: FixtureBroker(origin: macOrigin, offline: arguments.contains("--mac-offline")))
            connections.append(mac)
        }
        let signing = P256.Signing.PrivateKey()
        return VaultModel(vault: MemoryVault(empty: arguments.contains("--empty-vault")), authenticate: { reason in
            if arguments.contains("--cancel-authentication")
                || (arguments.contains("--cancel-add-confirmation") && reason == "Add this login to Harness Vault") {
                throw LAError(.userCancel)
            }
            return LAContext()
        }, fixtureConnections: connections, fixtureSign: { try signing.signature(for: $0).rawRepresentation })

    }
}
#endif
