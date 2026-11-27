import Foundation

/// Every connection comes from a QR pairing; no computer or address is built into the app.
@available(iOS 17.0, *)
extension VaultModel {
    func loadConnections() {
        do {
            for item in try savedPairedConnections() {
                try item.stored.configuration.validate()
                let endpoint = BrokerMachine.endpoint(of: item.stored.configuration.origin)
                guard !connections.contains(where: {
                    $0.machine.id == item.machine.id || BrokerMachine.endpoint(of: $0.configuration.origin) == endpoint
                }) else { continue }
                connections.append(BrokerConnection(machine: item.machine, stored: item.stored))
            }
        } catch {
            self.error = "Couldn’t open the paired computer settings. Unlock your device and reopen the app."
        }
    }

    func storePairedConnection(_ connection: BrokerConnection) throws {
        try saveConnection(connection.stored, for: connection.machine)
        if let index = connections.firstIndex(where: { $0.machine.id == connection.machine.id }) {
            connections[index] = connection
        } else {
            connections.append(connection)
        }
    }

    private func saveConnection(_ stored: StoredBrokerConnection, for machine: BrokerMachine) throws {
        var paired = try savedPairedConnections()
        paired.removeAll { $0.machine.id == machine.id }
        paired.append(PairedBrokerConnection(machine: machine, stored: stored))
        try keychain.write(JSONEncoder().encode(paired), to: PairedBrokerConnection.keychainAccount)
    }

    private func savedPairedConnections() throws -> [PairedBrokerConnection] {
        guard let data = try keychain.read(PairedBrokerConnection.keychainAccount) else { return [] }
        return try JSONDecoder().decode([PairedBrokerConnection].self, from: data)
    }

    func configure(_ updated: BrokerConfiguration, for connection: BrokerConnection) async -> Bool {
        await perform {
            try updated.validate()
            let endpoint = BrokerMachine.endpoint(of: updated.origin)
            guard let index = connections.firstIndex(where: { $0 === connection }) else {
                throw DeviceVaultError.invalidConfiguration
            }
            let other = connections.filter { $0 !== connection }
            guard !other.contains(where: { BrokerMachine.endpoint(of: $0.configuration.origin) == endpoint }) else {
                throw DeviceVaultError.duplicateBroker
            }
            guard !other.contains(where: { $0.configuration.deviceID == updated.deviceID }) else {
                throw DeviceVaultError.duplicateBrokerDevice
            }
            let context = try await authenticate("Save the broker connection")
            defer { context.invalidate() }
            let stored = StoredBrokerConnection(configuration: updated)
            try saveConnection(stored, for: connection.machine)
            connections[index] = BrokerConnection(machine: connection.machine, stored: stored)
        }
    }
}
