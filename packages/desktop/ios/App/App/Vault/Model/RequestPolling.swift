import Foundation

@available(iOS 17.0, *)
enum RequestPollState: Equatable {
    case checking
    case ready
    case failed(PollFailure)

    var statusLabel: String {
        switch self {
        case .checking: "Checking…"
        case .ready: "Online"
        case .failed(let failure): failure.isOffline ? "Offline" : failure.title
        }
    }

    var hasFailure: Bool {
        if case .failed = self { return true }
        return false
    }

    var isOffline: Bool {
        if case .failed(let failure) = self { return failure.isOffline }
        return false
    }
}

@available(iOS 17.0, *)
enum PollFailure: Equatable {
    case protectedRoute
    case network
    case serverUnreachable
    case enrollment
    case broker

    init(_ error: Error) {
        switch error {
        case BrokerError.routeProtected:
            self = .protectedRoute
        case BrokerError.serverUnreachable, BrokerError.http(500...599):
            self = .serverUnreachable
        case BrokerError.http(401), BrokerError.http(403), DeviceVaultError.missingKey:
            self = .enrollment
        case is URLError, BrokerError.transport:
            self = .network
        default:
            self = .broker
        }
    }

    var title: String {
        switch self {
        case .protectedRoute: "Broker route unavailable"
        case .network: "Can’t reach the broker"
        case .serverUnreachable: "Credential server unreachable"
        case .enrollment: "Device enrollment required"
        case .broker: "Couldn’t check requests"
        }
    }

    var isOffline: Bool { self == .network || self == .serverUnreachable }

    var message: String {
        switch self {
        case .protectedRoute: "The broker hasn’t enabled signed phone requests at this address."
        case .network: "Check your Wi-Fi or mobile data, then try again."
        case .serverUnreachable: "Try again shortly."
        case .enrollment: "Check that this iPhone’s signing key is enrolled as an approver."
        case .broker: "The broker couldn’t return the request queue. Try again."
        }
    }
}
