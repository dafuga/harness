import SwiftUI
import UIKit

/// This UIKit app has no SwiftUI scene, so a hosted view always reads its scene phase as
/// background: the Vault would stay covered and never poll. The phase comes from UIKit instead.
@available(iOS 17.0, *)
struct VaultSceneHost<Content: View>: View {
    @State private var phase = Self.current
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .environment(\.scenePhase, phase)
            .onReceive(Self.publisher(UIApplication.didBecomeActiveNotification)) { _ in phase = .active }
            .onReceive(Self.publisher(UIApplication.willResignActiveNotification)) { _ in phase = .inactive }
            .onReceive(Self.publisher(UIApplication.didEnterBackgroundNotification)) { _ in phase = .background }
            .onAppear { phase = Self.current }
    }

    private static var current: ScenePhase {
        switch UIApplication.shared.applicationState {
        case .active: .active
        case .inactive: .inactive
        default: .background
        }
    }

    private static func publisher(_ name: Notification.Name) -> NotificationCenter.Publisher {
        NotificationCenter.default.publisher(for: name)
    }
}
