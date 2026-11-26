import SwiftUI

struct ImportReviewView: View {
    let model: VaultModel
    let connection: BrokerConnection
    let request: ReviewedPasswordImport
    @Environment(\.dismiss) private var dismiss
    @State private var milliseconds: Int64?
    @State private var issue: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Import") {
                    LabeledContent("Broker", value: connection.machine.title)
                    if connection.pollState.isOffline { Text("Offline").foregroundStyle(.secondary) }
                    LabeledContent("Source", value: "Grok Bot on the box")
                    LabeledContent("Entries", value: String(request.services.count))
                    let left = milliseconds ?? connection.importClock.remaining(request.expiresAt)
                    LabeledContent("Time left", value: left > 0 ? "\((left + 999) / 1_000)s" : "Expired")
                        .monospacedDigit()
                }
                Section("Services") {
                    ForEach(Array(request.services.enumerated()), id: \.offset) { _, service in
                        LabeledContent(service.service, value: service.domain)
                    }
                }
                if let issue {
                    Section {
                        Text(issue).foregroundStyle(.secondary)
                    }
                }
                Section {
                    Button(approvalTitle) { submit(.approve) }
                        .accessibilityIdentifier("approve-import")
                    Button("Deny", role: .destructive) { submit(.deny) }
                        .accessibilityIdentifier("deny-import")
                }
                .disabled(model.workInProgress || !model.isCurrent(connection) || !connection.live(request))
            }
            .navigationTitle("Password import request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .interactiveDismissDisabled(model.workInProgress)
            .task {
                while !Task.isCancelled {
                    milliseconds = connection.importClock.remaining(request.expiresAt)
                    do { try await Task.sleep(for: .seconds(1)) } catch { return }
                }
            }
        }
    }

    private var approvalTitle: String {
        ProcessInfo.processInfo.isiOSAppOnMac || ProcessInfo.processInfo.isMacCatalystApp
            ? "Import with Touch ID" : "Import with Face ID"
    }

    private func submit(_ choice: PasswordImportDecision.Choice) {
        Task {
            issue = nil
            model.error = nil
            if await model.decideImport(request, at: connection, choice: choice) {
                dismiss()
            } else if let message = model.error {
                model.error = nil
                issue = message
            }
        }
    }
}
