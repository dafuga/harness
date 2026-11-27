import SwiftUI

@available(iOS 17.0, *)
struct VaultAddReviewView: View {
    let model: VaultModel
    let connection: BrokerConnection
    let request: VaultAddSummary
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var review: VaultAddReview?
    @State private var work: Task<Void, Never>?
    @State private var milliseconds: Int64?
    @State private var issue: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Login") {
                    if let review {
                        Text("Add \(request.siteName) (\(review.account))?").font(.headline)
                    } else {
                        Text("Add a login for \(request.siteName)").font(.headline)
                    }
                    LabeledContent("Site", value: request.domain)
                    LabeledContent("Computer", value: connection.machine.title)
                    let left = milliseconds ?? connection.remaining(request)
                    LabeledContent("Time left", value: left > 0 ? "\((left + 999) / 1_000)s" : "Expired")
                        .monospacedDigit()
                }
                if let issue {
                    Section { Text(issue).foregroundStyle(.secondary) }
                }
                Section {
                    if let review, review.isCurrent {
                        Button("Add with \(biometrics)") { approve(review) }
                            .accessibilityIdentifier("approve-vault-add")
                    } else {
                        Button("Review with \(biometrics)") { unlock() }
                            .accessibilityIdentifier("review-vault-add")
                    }
                    Button("Deny", role: .destructive) {
                        run { if await model.denyVaultAdd(request, at: connection) { dismiss() } }
                    }
                    .accessibilityIdentifier("deny-vault-add")
                }
                .disabled(work != nil || model.workInProgress
                          || !model.isCurrent(connection) || !connection.live(request))
            }
            .navigationTitle("Add login")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .interactiveDismissDisabled(work != nil)
        }
        .task {
            while !Task.isCancelled {
                milliseconds = connection.remaining(request)
                if work == nil, let review, !review.isCurrent || !connection.live(request) { closeReview() }
                do { try await Task.sleep(for: .seconds(1)) } catch { return }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { clearWork() }
        }
        .onDisappear { clearWork() }
    }

    private var biometrics: String {
        ProcessInfo.processInfo.isiOSAppOnMac || ProcessInfo.processInfo.isMacCatalystApp ? "Touch ID" : "Face ID"
    }

    private func unlock() {
        run {
            let unlocked = await model.reviewVaultAdd(request, at: connection)
            guard !Task.isCancelled else { return }
            review = unlocked
        }
    }

    private func approve(_ review: VaultAddReview) {
        run {
            if await model.approveVaultAdd(request, at: connection, review: review) { dismiss() }
            closeReview()
        }
    }

    private func run(_ operation: @escaping () async -> Void) {
        guard work == nil else { return }
        issue = nil
        model.error = nil
        work = Task {
            defer { work = nil }
            await operation()
            guard !Task.isCancelled, let error = model.error else { return }
            model.error = nil
            issue = error
        }
    }

    private func closeReview() {
        review = nil
    }

    private func clearWork() {
        work?.cancel()
        closeReview()
    }
}

@available(iOS 17.0, *)
extension VaultAddSummary {
    var siteName: String {
        switch service {
        case "npm-web": "npm"
        case "openai-platform": "OpenAI Platform"
        default: domain
        }
    }
}
