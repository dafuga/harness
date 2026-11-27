import SwiftUI

@available(iOS 17.0, *)
struct BackupBrokerSelection<Destination: View>: View {
    let connections: [BrokerConnection]
    @ViewBuilder var destination: (BrokerConnection) -> Destination

    var body: some View {
        if connections.count == 1, let only = connections.first {
            destination(only)
        } else {
            List(connections) { connection in
                NavigationLink(connection.machine.title) { destination(connection) }
            }
            .navigationTitle("Backup broker")
        }
    }
}

@available(iOS 17.0, *)
struct ExportBackupView: View {
    let model: VaultModel
    let connection: BrokerConnection
    @State private var includeRecoveryDevice = false
    @State private var peer = RecoveryPeer()
    @State private var references: [BackupReference] = []

    var body: some View {
        Form {
            LabeledContent("Broker", value: connection.machine.title)
            Section {
                Toggle("Include a recovery device", isOn: $includeRecoveryDevice)
                    .accessibilityIdentifier("include-recovery-device")
                if includeRecoveryDevice {
                    PeerFields(peer: $peer, keyLabel: "Backup public key")
                }
            } footer: {
                Text("A copy is always encrypted for this device. Verify the recovery device’s key fingerprint independently before exporting a second copy.")
            }
            Button("Encrypt and upload") {
                Task {
                    references = await model.exportBackup(to: includeRecoveryDevice ? peer : nil, at: connection)
                }
            }
            .disabled(model.workInProgress)
            if !references.isEmpty {
                Section {
                    ForEach(references) { reference in
                        PublicCode(label: "\(reference.deviceID) verification code", value: reference.fingerprint)
                    }
                } header: {
                    Text("Uploaded copies")
                } footer: {
                    Text("Keep the verification code for each recipient outside the broker. You’ll use it to confirm you’re restoring the intended backup.")
                }
            }
        }
        .navigationTitle("Export backup")
    }
}

@available(iOS 17.0, *)
struct RestoreBackupView: View {
    let model: VaultModel
    let connection: BrokerConnection
    @State private var peer = RecoveryPeer()
    @State private var fingerprint = ""
    @State private var confirm = false
    @State private var restored = false

    var body: some View {
        Form {
            LabeledContent("Broker", value: connection.machine.title)
            if connection.configuration.role == .recovery {
                Section("Source device") {
                    PeerFields(peer: $peer, keyLabel: "Signing public key")
                }
            }
            Section {
                BackupTextField(label: "Backup verification code", value: $fingerprint)
            } footer: {
                Text("Enter the recipient’s verification code from the export. After the first restore, you can leave it empty to restore the same verified snapshot.")
            }
            Button("Restore and replace entries", role: .destructive) { confirm = true }
                .disabled(model.workInProgress)
            if restored {
                Label("Backup restored", systemImage: "checkmark.circle")
                    .foregroundStyle(.green)
            }
        }
        .navigationTitle("Restore backup")
        .confirmationDialog("Replace this device’s vault entries?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Restore backup", role: .destructive) {
                Task {
                    restored = await model.restoreBackup(
                        from: peer, fingerprint: fingerprint.trimmingCharacters(in: .whitespacesAndNewlines),
                        at: connection
                    )
                }
            }
        }
    }
}

@available(iOS 17.0, *)
private struct PeerFields: View {
    @Binding var peer: RecoveryPeer
    let keyLabel: String

    var body: some View {
        BackupTextField(label: "Device ID", value: $peer.deviceID)
        BackupTextField(label: keyLabel, value: $peer.key)
        BackupTextField(label: "Public-key fingerprint", value: $peer.fingerprint)
    }
}

@available(iOS 17.0, *)
private struct BackupTextField: View {
    let label: String
    @Binding var value: String

    var body: some View {
        TextField(label, text: $value)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
    }
}
