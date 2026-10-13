import AVFoundation
import UIKit

/// What the camera sees while a person scans, with one line of help and a way to cancel. The
/// first QR code ends it; so does Cancel, and so does anything that takes the view away.
final class RemoteScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let session: AVCaptureSession
    private let queue = DispatchQueue(label: "com.dafuga.harness.scanner")
    private var done: ((RemoteScanOutcome) -> Void)?
    private lazy var preview = AVCaptureVideoPreviewLayer(session: session)

    /// Nil where this device has no camera that can read a QR code, as on a simulator.
    static func make(done: @escaping (RemoteScanOutcome) -> Void) -> RemoteScannerViewController? {
        let session = AVCaptureSession()
        let output = AVCaptureMetadataOutput()
        guard let camera = AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: camera),
            session.canAddInput(input), session.canAddOutput(output)
        else { return nil }
        session.addInput(input)
        session.addOutput(output)
        guard output.availableMetadataObjectTypes.contains(.qr) else { return nil }
        output.metadataObjectTypes = [.qr]
        let controller = RemoteScannerViewController(session: session, done: done)
        output.setMetadataObjectsDelegate(controller, queue: .main)
        return controller
    }

    private init(session: AVCaptureSession, done: @escaping (RemoteScanOutcome) -> Void) {
        self.session = session
        self.done = done
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)
        let help = UILabel()
        help.text = "Scan the code under Pair a phone on your computer."
        help.textColor = .white
        help.textAlignment = .center
        help.numberOfLines = 0
        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.white, for: .normal)
        cancel.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        cancel.addTarget(self, action: #selector(cancelled), for: .touchUpInside)
        place(help, cancel)
    }

    /// The help under the top edge and Cancel above the bottom one, inside the safe area.
    private func place(_ help: UILabel, _ cancel: UIButton) {
        let area = view.safeAreaLayoutGuide
        for item in [help, cancel] as [UIView] {
            item.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(item)
        }
        NSLayoutConstraint.activate([
            help.topAnchor.constraint(equalTo: area.topAnchor, constant: 24),
            help.leadingAnchor.constraint(equalTo: area.leadingAnchor, constant: 24),
            help.trailingAnchor.constraint(equalTo: area.trailingAnchor, constant: -24),
            cancel.centerXAnchor.constraint(equalTo: area.centerXAnchor),
            cancel.bottomAnchor.constraint(equalTo: area.bottomAnchor, constant: -24),
            cancel.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        queue.async { self.session.startRunning() }
    }

    /// A view that went away without an answer was cancelled: a scan never stays open unseen.
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        queue.async { self.session.stopRunning() }
        answer(.cancelled)
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection
    ) {
        let codes = objects.compactMap { $0 as? AVMetadataMachineReadableCodeObject }
        guard let text = codes.first(where: { $0.type == .qr })?.stringValue else { return }
        finish(.text(text))
    }

    @objc private func cancelled() {
        finish(.cancelled)
    }

    /// The scan was ended from outside: the camera goes away as it does after Cancel.
    func withdraw() {
        finish(.cancelled)
    }

    /// Takes the view away first; the answer follows once nothing of the camera is on screen.
    private func finish(_ outcome: RemoteScanOutcome) {
        guard let done = done else { return }
        self.done = nil
        dismiss(animated: true) { done(outcome) }
    }

    private func answer(_ outcome: RemoteScanOutcome) {
        guard let done = done else { return }
        self.done = nil
        done(outcome)
    }
}
