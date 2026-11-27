import SwiftUI

@available(iOS 17.0, *)
struct PairingView: View {
    let model: VaultModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var offer: PairingOffer?
    @State var paired = false
    @State var issue: String?
    @State var freshOfferNeeded = false
    @State var work: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if paired {
                    ContentUnavailableView("Pairing complete", systemImage: "checkmark.shield",
                        description: Text("This computer can now send requests to your iPhone."))
                } else if let offer {
                    review(offer)
                } else if let issue {
                    ContentUnavailableView {
                        Label("Can’t use this QR code", systemImage: "qrcode.viewfinder")
                    } description: {
                        Text(issue)
                    } actions: {
                        Button("Scan again") { reset() }.buttonStyle(.borderedProminent)
                    }
                } else {
                    PairingQRScanner(scanned: scan)
                }
            }
            .navigationTitle("Pair a computer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(paired ? "Done" : "Cancel") { dismiss() }
                }
            }

        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { reset() }
        }
        .onDisappear { work?.cancel() }
        #if DEBUG && targetEnvironment(simulator)
        .task {
            if ProcessInfo.processInfo.arguments.contains("--pairing-fixture") {
                scan(PairingFixture.scanPayload())
            }
        }
        #endif
    }

    private func review(_ offer: PairingOffer) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let expired = offer.expiresAt <= PairingOffer.timestamp
            Form {
                Section("Computer") {
                    LabeledContent("Machine", value: model.pairingMachine(for: offer).title)
                    LabeledContent("Broker", value: offer.origin)
                }
                if expired || freshOfferNeeded {
                    Section {
                        Text(expired ? "This QR code expired. Open a fresh pairing QR on the computer."
                             : issue ?? "Open a fresh pairing QR on the computer.")
                        Button("Scan again") { reset() }
                    }
                } else {
                    Section {
                        Button("Pair with Face ID") { submit(offer) }
                            .accessibilityIdentifier("confirm-pairing")
                            .disabled(work != nil || model.workInProgress)
                        if work != nil { ProgressView("Pairing") }
                        if let issue { Text(issue).foregroundStyle(.secondary) }
                        Button("Scan another QR code") { reset() }.disabled(work != nil)
                    }
                }
            }
        }
    }
}
