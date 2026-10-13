import AVFoundation
import UIKit

/// The camera of this phone, for one purpose: reading the QR code a computer shows. It asks the
/// system for access, shows what the camera sees with a way to cancel, and answers once with
/// the first QR code it reads. It decides nothing about what it read, and nothing but the
/// camera can hand it a code.
final class RemoteCameraScanner: RemoteScanner {
    private let presenter: () -> UIViewController?
    private weak var shown: RemoteScannerViewController?
    private var ended = false

    /// `presenter` is asked on the main queue, when the camera is about to be shown.
    init(presenter: @escaping () -> UIViewController?) {
        self.presenter = presenter
    }

    /// May be called on any queue; the camera and its answer are on the main one.
    func scan(done: @escaping (RemoteScanOutcome) -> Void) {
        DispatchQueue.main.async { self.ask(done) }
    }

    /// Takes the camera away. A scan that is not on screen yet is never shown.
    func cancel() {
        DispatchQueue.main.async {
            self.ended = true
            self.shown?.withdraw()
        }
    }

    private func ask(_ done: @escaping (RemoteScanOutcome) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: show(done)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { granted ? self.show(done) : done(.denied) }
            }
        default: done(.denied)
        }
    }

    private func show(_ done: @escaping (RemoteScanOutcome) -> Void) {
        guard !ended else { return done(.cancelled) }
        guard let presenter = presenter(), let controller = RemoteScannerViewController.make(done: done) else {
            return done(.unavailable)
        }
        controller.modalPresentationStyle = .fullScreen
        shown = controller
        presenter.present(controller, animated: true)
    }
}
