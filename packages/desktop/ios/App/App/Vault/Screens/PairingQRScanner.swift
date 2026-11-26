import SwiftUI

#if !targetEnvironment(macCatalyst)
import AVFoundation
import VisionKit
#endif

struct PairingQRScanner: View {
    let scanned: (String) -> Void
    @State private var cameraReady = false
    @State private var cameraIssue: String?

    var body: some View {
        #if targetEnvironment(macCatalyst)
        ContentUnavailableView("Scan on iPhone", systemImage: "qrcode.viewfinder",
                               description: Text("Open Harness Vault on your iPhone to scan the computer’s QR code."))
        #else
        Group {
            if let cameraIssue {
                ContentUnavailableView("Camera unavailable", systemImage: "camera",
                                       description: Text(cameraIssue))
            } else if cameraReady {
                LivePairingScanner(scanned: scanned) {
                    cameraIssue = "Try opening the pairing screen again."
                }
            } else {
                ProgressView("Opening camera")
            }
        }
        .task {
            guard DataScannerViewController.isSupported else {
                cameraIssue = "Open Harness Vault on your iPhone to scan the computer’s QR code."
                return
            }
            let allowed: Bool
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                allowed = true
            case .notDetermined:
                allowed = await AVCaptureDevice.requestAccess(for: .video)
            default:
                allowed = false
            }
            guard !Task.isCancelled else { return }
            if allowed, DataScannerViewController.isAvailable {
                cameraReady = true
            } else {
                cameraIssue = "Allow camera access for Harness Vault in Settings, then reopen pairing."
            }
        }
        #endif
    }
}

#if !targetEnvironment(macCatalyst)
private struct LivePairingScanner: UIViewControllerRepresentable {
    let scanned: (String) -> Void
    let unavailable: () -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])],
                                               recognizesMultipleItems: false, isHighlightingEnabled: true)
        scanner.delegate = context.coordinator
        Task { @MainActor [weak scanner] in
            do { try scanner?.startScanning() }
            catch { unavailable() }
        }
        return scanner
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ controller: DataScannerViewController, coordinator: Coordinator) {
        controller.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(scanned: scanned, unavailable: unavailable) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let scanned: (String) -> Void
        let unavailable: () -> Void
        private var delivered = false

        init(scanned: @escaping (String) -> Void, unavailable: @escaping () -> Void) {
            self.scanned = scanned
            self.unavailable = unavailable
        }

        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem],
                         allItems: [RecognizedItem]) {
            guard !delivered, case .barcode(let item)? = addedItems.first, let payload = item.payloadStringValue else {
                return
            }
            delivered = true
            scanner.stopScanning()
            scanned(payload)
        }

        func dataScanner(_ scanner: DataScannerViewController,
                         becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
            unavailable()
        }
    }
}
#endif
