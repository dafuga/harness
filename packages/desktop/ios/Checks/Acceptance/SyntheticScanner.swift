import UIKit

/// TEST ONLY. Stands where App/App/Scanner/RemoteCameraScanner.swift stands in an isolated copy
/// of the native source that an acceptance run builds for a simulator, which has no camera. It
/// is not part of the app target, and no product built from the real source holds it. What it
/// hands over is judged exactly like a scanned code: it can ask, and it can grant nothing.
final class RemoteCameraScanner: RemoteScanner {
    /// What the scans of this launch answer, in order, from `-HarnessSyntheticScans a|b|c`: the
    /// words denied, cancelled and unavailable are those endings, and any other part is the text
    /// a camera read. After the last part a scan finds no camera.
    private static var parts = (UserDefaults.standard.string(forKey: "HarnessSyntheticScans") ?? "")
        .split(separator: "|").map(String.init)

    init(presenter: @escaping () -> UIViewController?) {}

    func scan(done: @escaping (RemoteScanOutcome) -> Void) {
        DispatchQueue.main.async { done(Self.next()) }
    }

    func cancel() {}

    private static func next() -> RemoteScanOutcome {
        guard !parts.isEmpty else { return .unavailable }
        switch parts.removeFirst() {
        case "denied": return .denied
        case "cancelled": return .cancelled
        case "unavailable": return .unavailable
        case let text: return .text(text)
        }
    }
}
