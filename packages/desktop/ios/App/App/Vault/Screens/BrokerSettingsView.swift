import SwiftUI

struct BrokerSettingsView: View {
    let model: VaultModel
    @Binding var alertsEnabled: Bool
    @State private var publicEnrollment: PublicEnrollment?
    @State private var showPairing = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button("Pair a computer", systemImage: "qrcode.viewfinder") { showPairing = true }
                        .accessibilityIdentifier("pair-computer")
                }
                ForEach(model.connections) { connection in
                    Section(connection.machine.title) {
                        NavigationLink {
                            BrokerConnectionView(model: model, connection: connection, draft: connection.configuration)
                        } label: {
                            LabeledContent("Connection", value: connection.configuration.origin)
                        }
                    }
                }
                Section {
                    Toggle("Request notifications", isOn: $alertsEnabled)
                } footer: {
                    #if VAULT_APNS
                    Text("Paired computers with push enabled can send alerts when the app is closed.")
                    #else
                    Text("New requests are checked while the app is open.")
                    #endif
                }
                Section("Encrypted backup") {
                    let approvers = model.connections.filter { $0.configuration.role == .approver }
                    NavigationLink("Export backup") {
                        BackupBrokerSelection(connections: approvers) { connection in
                            ExportBackupView(model: model, connection: connection)
                        }
                    }
                    .disabled(approvers.isEmpty)
                    NavigationLink("Restore backup") {
                        BackupBrokerSelection(connections: model.connections) { connection in
                            RestoreBackupView(model: model, connection: connection)
                        }
                    }
                    NavigationLink("Recovery keys") {
                        BackupBrokerSelection(connections: model.connections) { connection in
                            Button("Show recovery keys") {
                                Task { publicEnrollment = await model.recoveryKeys(for: connection) }
                            }
                            .disabled(model.workInProgress)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showPairing) { PairingView(model: model) }
            .sheet(item: $publicEnrollment) { enrollment in
                EnrollmentView(enrollment: enrollment)
            }
        }
    }
}

private struct BrokerConnectionView: View {
    let model: VaultModel
    let connection: BrokerConnection
    @State var draft: BrokerConfiguration
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section("Device") {
                TextField("HTTPS broker origin", text: $draft.origin)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Device ID", text: $draft.deviceID)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Picker("Role", selection: $draft.role) {
                    Text("Approver").tag(DeviceRole.approver)
                    Text("Recovery").tag(DeviceRole.recovery)
                }
            }
        }
        .navigationTitle(connection.machine.title)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        draft.origin = draft.origin.trimmingCharacters(in: .whitespacesAndNewlines)
                        draft.deviceID = draft.deviceID.trimmingCharacters(in: .whitespacesAndNewlines)
                        if await model.configure(draft, for: connection) { dismiss() }
                    }
                }
                .disabled(model.workInProgress)
            }
        }

    }
}
