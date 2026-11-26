import SwiftUI

extension RequestReviewView {
    var missingItem: some View {
        Section("Vault item missing") {
            LabeledContent("Site", value: request.site ?? request.service)
                .accessibilityIdentifier("missing-item-site")
            LabeledContent("Account", value: request.account ?? "Not supplied by the requester")
                .accessibilityIdentifier("missing-item-account")
            if accountMismatch {
                Text("A different account is saved for this service. Ask the requester for a vault item name for this account.")
                    .foregroundStyle(.secondary)
            } else {
                Button("Add it now") {
                    var entry = VaultEntry(service: request.service, username: request.account ?? "", password: "")
                    entry.domain = request.site
                    adding = entry
                }
                .accessibilityIdentifier("add-requested-entry")
            }
            denyButton
        }
        .disabled(actionsDisabled)
    }

    var denyButton: some View {
        Button("Deny", role: .destructive) { send(approved: false) }
            .accessibilityIdentifier("deny-request")
    }

    var approvalTitle: String {
        ProcessInfo.processInfo.isiOSAppOnMac || ProcessInfo.processInfo.isMacCatalystApp
            ? "Approve with Touch ID" : "Approve with Face ID"
    }

    func send(approved: Bool) {
        let code = approved ? otp : ""
        otp = ""
        Task {
            switch await model.decide(request, at: connection, approved: approved, otp: code) {
            case .sent: dismiss()
            case .pending: break
            case .accountMismatch: accountMismatch = true
            }
        }
    }
}
