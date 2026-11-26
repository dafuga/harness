import SwiftUI
import UniformTypeIdentifiers

@available(iOS 17.0, *)
struct EnrollmentView: View {
    let enrollment: PublicEnrollment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PublicCode(label: "Signing public key", value: enrollment.signingKey)
                    PublicCode(label: "Signing fingerprint", value: enrollment.signingFingerprint)
                } header: {
                    Text("Backup source")
                } footer: {
                    Text("Verify the source’s signing fingerprint independently before restoring a backup.")
                }
                Section("Recovery") {
                    PublicCode(label: "Backup public key", value: enrollment.recoveryKey)
                    PublicCode(label: "Backup key fingerprint", value: enrollment.recoveryFingerprint)
                }
            }
            .navigationTitle("\(enrollment.machine.title) recovery keys")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}

@available(iOS 17.0, *)
struct PublicCode: View {
    let label: String
    let value: String
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.subheadline.weight(.semibold))
            Text(value).font(.footnote.monospaced())
                .fixedSize(horizontal: false, vertical: true)
            Button(copied ? "Copied" : "Copy \(label.lowercased())") {
                UIPasteboard.general.setItems(
                    [[UTType.utf8PlainText.identifier: value]],
                    options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(120)]
                )
                copied = true
            }
            .font(.footnote)
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 4)
    }
}
