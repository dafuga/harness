import SwiftUI

/// The Vault screens of the Harness app. Secrets stay in these native views: the web view only
/// asks for them to be shown and never receives a request, an entry or a decision.
@available(iOS 17.0, *)
struct VaultRootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State var model = VaultModel.make()
    @State var tab = Tab.requests
    @State var requestToOpen: BrokerPushTarget?
    @State var notificationReview: InboxItem?
    @AppStorage("vault-request-notifications") var alertsEnabled = false
    let notifications: VaultNotifications
    let close: () -> Void

    var body: some View {
        TabView(selection: $tab) {
            RequestsView(model: model, notificationReview: $notificationReview, close: close)
                .tabItem { Label("Requests", systemImage: "checkmark.shield") }
                .tag(Tab.requests)
            EntriesView(model: model)
                .tabItem { Label("Vault", systemImage: "lock") }
                .tag(Tab.entries)
            BrokerSettingsView(model: model, alertsEnabled: $alertsEnabled)
                .tabItem { Label("Settings", systemImage: "gear") }
                .tag(Tab.settings)
        }
        .onChange(of: notifications.tappedRequest, initial: true) { _, target in
            guard let target else { return }
            notifications.tappedRequest = nil
            openNotification(target)
        }
        .task(id: RegistrationScope(phase: scenePhase, enabled: alertsEnabled)) { await register() }
        .overlay {
            if scenePhase == .background {
                Rectangle().fill(.background).ignoresSafeArea()
                    .overlay(Image(systemName: "lock.shield").font(.largeTitle))
                    .accessibilityHidden(true)
            }
        }
        .background {
            ForEach(model.connections) { connection in
                Color.clear.frame(width: 0, height: 0)
                    .task(id: PollScope(phase: scenePhase, generation: connection.pollGeneration)) {
                        guard scenePhase == .active, connection.configuration.role == .approver else { return }
                        await pollWhileActive(connection)
                    }
            }
        }
        .alert("Harness Vault", isPresented: Binding(
            get: { model.error != nil },
            set: { if !$0 { model.error = nil } }
        )) {
            Button("OK", role: .cancel) { model.error = nil }
        } message: {
            Text(model.error ?? "")
        }
    }

    private func register() async {
        guard scenePhase == .active else { return }
        let enabled = alertsEnabled
        let granted = await notifications.refreshRegistration(enabled: enabled)
        if enabled, !granted, !Task.isCancelled {
            alertsEnabled = false
            model.error = "Allow Harness notifications in iOS Settings to enable alerts."
        }
    }

    enum Tab {
        case requests, entries, settings
    }

    private struct RegistrationScope: Equatable {
        let phase: ScenePhase
        let enabled: Bool
    }

    private struct PollScope: Equatable {
        let phase: ScenePhase
        let generation: Int
    }
}
