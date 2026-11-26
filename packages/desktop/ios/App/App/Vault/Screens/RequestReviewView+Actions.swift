import SwiftUI

extension RequestReviewView {
    var missingItem: some View {
        Section("Vault item missing") {
            LabeledContent("Site", value: request.site ?? request.service)
                .accessibilityIdentifier("missing-item-site")
            LabeledContent("Account", value: request.account ?? "Not supplied by the requester")
                .accessibilityIdentifier("missing-item-account")
            Button("Add it now") {
                var entry = VaultEntry(service: request.service, username: request.account ?? "", password: "")
                entry.domain = request.websiteDomain ?? request.site
                adding = entry
            }
            .accessibilityIdentifier("add-requested-entry")
            denyButton
        }
        .disabled(actionsDisabled)
    }

    var approval: some View {
        Group {
            // A deferred sign-in asks for its code later, once the site wants it.
            if !approvalOnly && request.deferredOtp != true { codeField }
            Section {
                Button(approvalTitle) { send(approved: true) }
                    .accessibilityIdentifier("approve-request")
                    .disabled(approvalBlocked)
                denyButton
            }
            .disabled(actionsDisabled)
        }
    }

    private var codeRequired: Bool { model.requiresServiceOTP(for: request, entry: selection) }

    private var codeField: some View {
        Section(codeRequired ? "Required verification code" : "Optional verification code") {
            ProtectedField("One-time code", text: $otp, secure: true)
                .frame(minHeight: 28)
                .accessibilityIdentifier("request-otp")
        }
    }

    private var approvalBlocked: Bool {
        if releasesLogin && model.entry(selection, for: request) == nil { return true }
        return codeRequired && otp.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var denyButton: some View {
        Button("Deny", role: .destructive) { send(approved: false) }
            .accessibilityIdentifier("deny-request")
    }

    private var approvalTitle: String {
        ProcessInfo.processInfo.isiOSAppOnMac || ProcessInfo.processInfo.isMacCatalystApp
            ? "Approve with Touch ID" : "Approve with Face ID"
    }

    private func send(approved: Bool) {
        let answer = RequestAnswer(approved: approved, otp: approved ? otp : "", entry: selection)
        otp = ""
        Task {
            if await model.decide(request, at: connection, answer: answer) { dismiss() }
        }
    }
}
