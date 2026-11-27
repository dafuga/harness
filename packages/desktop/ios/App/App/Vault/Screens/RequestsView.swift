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
