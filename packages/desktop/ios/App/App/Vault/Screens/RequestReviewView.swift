import SwiftUI

struct RequestReviewView: View {
    let model: VaultModel
    let connection: BrokerConnection
    let request: BrokerRequest
    @Environment(\.dismiss) var dismiss
    @State var otp = ""
    @State private var showCommand = false
    @State private var clockTick: Int64 = 0
    @State var adding: VaultEntry?
    @State var accountMismatch = false

    private var approvalOnly: Bool { request.approvalOnly == true }
    private var missingEntry: Bool { !approvalOnly && (model.entry(for: request) == nil || accountMismatch) }
    var actionsDisabled: Bool {
        model.workInProgress || !model.isCurrent(connection) || !connection.live(request) || clockTick >= request.expiresAt
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Request") {
                    LabeledContent("Broker", value: connection.machine.title)
                    if connection.pollState.isOffline { Text("Offline").foregroundStyle(.secondary) }
                    LabeledContent("Service", value: request.service)
                    LabeledContent("Action", value: request.action)
                    LabeledContent("Tracker item", value: request.itemId)
                        .accessibilityIdentifier("request-tracker-item")
                    LabeledContent("Session", value: request.session)
                    Text(request.reason)
                    if approvalOnly {
                        Label("Approval only · No vault item needed", systemImage: "checkmark.shield")
                    } else if model.requiresServiceOTP(for: request) {
                        Label("Fresh phone approval required", systemImage: "faceid")
                    }
                    let seconds = max(0, (request.expiresAt - max(clockTick, connection.releaseClock.now) + 999) / 1_000)
                    LabeledContent("Time left", value: seconds > 0 ? "\(seconds)s" : "Expired")
                        .monospacedDigit()
                }
                if missingEntry { missingItem }
                Section("Session key fingerprint") {
                    Text(request.sessionKeyFingerprint.prefix(32) + "\n" + request.sessionKeyFingerprint.suffix(32))
                        .font(.footnote.monospaced())
                    DisclosureGroup("Command details", isExpanded: $showCommand) {
                        Text(request.command.executable).font(.footnote.monospaced())
                        ForEach(Array(request.command.args.enumerated()), id: \.offset) { _, argument in
                            Text(argument).font(.footnote.monospaced())
                        }
                        LabeledContent("Directory", value: request.command.cwd)
                        if let uid = request.clientUid {
                            LabeledContent("Linux UID", value: String(uid))
                        }
                    }
                }
                if !missingEntry {
                    if !approvalOnly {
                        Section(model.requiresServiceOTP(for: request) ? "Required verification code" : "Optional verification code") {
                            ProtectedField("One-time code", text: $otp, secure: true)
                                .frame(minHeight: 28)
                                .accessibilityIdentifier("request-otp")
                        }
                    }
                    Section {
                        Button(approvalTitle) { send(approved: true) }
                            .accessibilityIdentifier("approve-request")
                            .disabled(model.requiresServiceOTP(for: request)
                                      && otp.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        denyButton
                    }
                    .disabled(actionsDisabled)
                }
            }
            .navigationTitle("Review request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .sheet(item: $adding) { entry in
                EntryEditor(model: model, entry: entry, lockService: true, lockAccount: request.account != nil)
            }
            .interactiveDismissDisabled(model.workInProgress)
        }
        .task {
            while !Task.isCancelled {
                clockTick = connection.releaseClock.now
                do { try await Task.sleep(for: .seconds(1)) } catch { return }
            }
        }
        .onDisappear { otp = "" }
    }
}
