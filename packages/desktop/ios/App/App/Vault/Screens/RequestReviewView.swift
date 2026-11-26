import SwiftUI

struct RequestReviewView: View {
    let model: VaultModel
    let connection: BrokerConnection
    let request: BrokerRequest
    @Environment(\.dismiss) var dismiss
    @State var otp = ""
    @State var selection: UUID?
    @State private var showCommand = false
    @State private var clockTick: Int64 = 0
    @State var adding: VaultEntry?

    var approvalOnly: Bool { request.approvalOnly == true }
    /// True when approving releases a saved password.
    var releasesLogin: Bool { !approvalOnly && request.codeOnly != true }
    private var missingEntry: Bool { releasesLogin && model.accounts(for: request) == .missing }
    var actionsDisabled: Bool {
        model.workInProgress || !model.isCurrent(connection) || !connection.live(request) || clockTick >= request.expiresAt
    }

    var body: some View {
        NavigationStack {
            Form {
                summary
                if missingEntry {
                    missingItem
                } else if releasesLogin {
                    VaultAccountPickerSection(
                        match: model.accounts(for: request), site: request.site ?? request.service,
                        requestedAccount: request.account, selection: $selection
                    )
                }
                commandDetails
                if !missingEntry { approval }
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

    private var summary: some View {
        Section("Request") {
            LabeledContent("Broker", value: connection.machine.title)
            if connection.pollState.isOffline { Text("Offline").foregroundStyle(.secondary) }
            LabeledContent("Service", value: request.service)
            LabeledContent("Action", value: request.action)
            LabeledContent("Tracker item", value: request.itemId)
                .accessibilityIdentifier("request-tracker-item")
            LabeledContent("Session", value: request.session)
            Text(request.reason)
            modeNote
            let seconds = max(0, (request.expiresAt - max(clockTick, connection.releaseClock.now) + 999) / 1_000)
            LabeledContent("Time left", value: seconds > 0 ? "\(seconds)s" : "Expired")
                .monospacedDigit()
        }
    }

    @ViewBuilder private var modeNote: some View {
        if approvalOnly {
            Label("Approval only · No vault item needed", systemImage: "checkmark.shield")
        } else if request.codeOnly == true {
            Label("Verification code only · No password is sent", systemImage: "number")
        } else if request.deferredOtp == true {
            Label("Password now · A code may be asked for next", systemImage: "faceid")
        } else if model.requiresServiceOTP(for: request, entry: selection) {
            Label("Fresh phone approval required", systemImage: "faceid")
        }
    }

    private var commandDetails: some View {
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
    }
}
