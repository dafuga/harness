import Foundation

/// How a look through the camera ended, before anything is known about what was read.
enum RemoteScanOutcome {
    case text(String)
    case denied
    case unavailable
    case cancelled
}

/// Every way a scan ends without an offer. The raw value is the code the page is given; the
/// list and its order are `remoteScanFailures` of packages/remote.
enum RemoteScanFailure: String, Error, CaseIterable {
    case cameraDenied = "camera-denied"
    case cameraUnavailable = "camera-unavailable"
    case cancelled = "scan-cancelled"
    case invalid = "offer-invalid"
    case unsupported = "offer-unsupported"
    case environment = "offer-environment"
    case expired = "offer-expired"

    var message: String {
        switch self {
        case .cameraDenied: return "Camera access is off for Harness."
        case .cameraUnavailable: return "This device has no camera that can scan a code."
        case .cancelled: return "Scanning was cancelled. Nothing was sent."
        case .invalid: return "That is not a Harness pairing code."
        case .unsupported: return "That code is for another version of Harness."
        case .environment: return "That code is for a relay this build of Harness does not accept."
        case .expired: return "That code has expired."
        }
    }

    /// The same ending as the page is told it: its code and its words.
    var failure: RemoteFailure {
        RemoteFailure(code: rawValue, message: message)
    }
}

/// The camera of the phone as pairing sees it: it shows itself and answers once. It may be
/// asked and may answer on any queue. `cancel` takes it away; what it answers then is ignored.
protocol RemoteScanner: AnyObject {
    func scan(done: @escaping (RemoteScanOutcome) -> Void)
    func cancel()
}

/// From what a camera saw to what this phone asks with. A scan is trusted for nothing: its text
/// is read by the rule of an offer, and the result is only a request that a person still has to
/// approve on the computer, for the exact key of this phone.
enum RemoteScanFlow {
    /// The name a person gave this phone, as the computer will show it, or nil.
    static func name(_ value: String?) -> String? {
        let name = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty || name.count > 80 ? nil : name
    }

    static func input(
        _ outcome: RemoteScanOutcome, deviceName: String, now: Date = Date()
    ) -> Result<RemotePairing.Input, RemoteScanFailure> {
        switch outcome {
        case .denied: return .failure(.cameraDenied)
        case .unavailable: return .failure(.cameraUnavailable)
        case .cancelled: return .failure(.cancelled)
        case .text(let text):
            switch RemoteOffer.read(text, now: now, environments: RemotePolicy.environments) {
            case .failure(let refusal): return .failure(failure(refusal))
            case .success(let offer):
                return .success(RemotePairing.Input(
                    origin: offer.origin, hostId: offer.hostId, pairingId: offer.pairingId, code: offer.code,
                    deviceName: deviceName))
            }
        }
    }

    private static func failure(_ refusal: RemoteOffer.Refusal) -> RemoteScanFailure {
        switch refusal {
        case .invalid: return .invalid
        case .unsupported: return .unsupported
        case .environment: return .environment
        case .expired: return .expired
        }
    }
}
