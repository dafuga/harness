import SwiftUI

@available(iOS 17.0, *)
struct RequestsView: View {
    let model: VaultModel
    @Binding var notificationReview: InboxItem?
    var close: (() -> Void)?
    @Environment(\.scenePhase) private var scenePhase
    @State var reviewing: InboxItem?

    private var approvers: [BrokerConnection] {
        model.connections.filter { $0.configuration.role == .approver }
    }

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                if approvers.isEmpty {
                    ContentUnavailableView("Recovery device", systemImage: "lock.shield",
                        description: Text("Use Settings to restore a verified backup."))
                } else {
                    inbox(approvers)
                }
            }
            .navigationTitle("Requests")
            .toolbar {
                if let close {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done", action: close).accessibilityIdentifier("close-vault")
                    }
                }
                if !approvers.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Refresh requests", systemImage: "arrow.clockwise", action: model.retryPoll)
                    }
                }
            }
            .sheet(item: $reviewing) { item in
                switch item.kind {
                case .release(let request):
                    RequestReviewView(model: model, connection: item.connection, request: request)
                case .privateBrowser(let offer):
                    PrivateBrowserReviewView(model: model, connection: item.connection, offer: offer)
                case .vaultAdd(let request):
                    VaultAddReviewView(model: model, connection: item.connection, request: request)
                case .passwordImport(let request):
                    ImportReviewView(model: model, connection: item.connection, request: request)
                }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { reviewing = nil }
        }
        .onChange(of: notificationReview?.id, initial: true) { _, _ in
            guard let notificationReview else { return }
            reviewing = notificationReview
            self.notificationReview = nil
        }
    }
}


@available(iOS 17.0, *)
private struct PrivateBrowserReviewView: View {
    let model: VaultModel
    let connection: BrokerConnection
    let offer: PrivateBrowserOffer
    @Environment(\.dismiss) private var dismiss
    @State private var value = ""
    @State private var submission: Task<Void, Never>?
    @State private var receipt = false

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Form {
                    Section("Request") {
                        LabeledContent("Broker", value: connection.machine.title)
                        LabeledContent("Website", value: offer.website)
                        LabeledContent("Action", value: offer.action.replacingOccurrences(of: "-", with: " ").capitalized)
                    }
                    if receipt {
                        Label("Private entry completed", systemImage: "checkmark.circle")
                    } else if connection.live(offer), model.isCurrent(connection) {
                        entry.onDisappear { value = "" }
                    } else {
                        Text("This private entry is no longer available.").foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Private entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(receipt ? "Done" : "Close") { dismiss() }
                }
            }
        }
        .onDisappear {
            value = ""
            submission?.cancel()
        }
    }

    private var entry: some View {
        Section("Secure input") {
            ProtectedField(offer.field.replacingOccurrences(of: "-", with: " ").capitalized, text: $value, secure: true)
                .frame(minHeight: 28)
                .accessibilityIdentifier("private-browser-field")
            Button("Approve and submit", action: send)
                .accessibilityIdentifier("submit-private-browser-field")
                .disabled(value.isEmpty || value.utf8.count > 8_192 || submission != nil)
            if submission != nil { ProgressView("Submitting") }
        }
        .disabled(model.workInProgress)
    }

    private func send() {
        let field = value
        value = ""
        submission = Task {
            receipt = await model.submitPrivateField(field, for: offer, at: connection)
            submission = nil
        }
    }
}
