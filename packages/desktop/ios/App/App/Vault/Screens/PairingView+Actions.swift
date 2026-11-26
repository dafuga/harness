import SwiftUI

extension PairingView {
    func scan(_ payload: String) {
        guard offer == nil, !paired else { return }
        do {
            offer = try PairingOffer(scan: payload)
        } catch { issue = Self.message(for: error) }
    }

    func submit(_ offer: PairingOffer) {
        guard work == nil else { return }
        issue = nil
        work = Task {
            defer { work = nil }
            do {
                try await model.pair(offer)
                try Task.checkCancellation()
                paired = true
                self.offer = nil
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled else { return }
                showFailure(error)
            }
        }
    }

    private func showFailure(_ error: Error) {
        switch error {
        case PairingError.activationUnconfirmed, PairingError.expired,
             BrokerError.http(404), BrokerError.http(410), BrokerError.http(429):
            freshOfferNeeded = true
        default:
            break
        }
        issue = Self.message(for: error)
    }

    func reset() {
        work?.cancel()
        offer = nil
        issue = nil
        freshOfferNeeded = false
    }

    private static func message(for error: Error) -> String {
        switch error {
        case PairingError.invalidOffer:
            "Scan the pairing QR shown by Harness Vault on your computer."
        case PairingError.expired, BrokerError.http(404), BrokerError.http(410):
            "This pairing offer has ended. Open a fresh QR code on the computer."
        case PairingError.activationUnconfirmed:
            "The computer hasn’t confirmed pairing. Check its terminal before opening a fresh QR code."
        case BrokerError.http(429):
            "The broker received too many pairing attempts. Wait a minute, then open a fresh QR code."
        case BrokerError.routeProtected:
            "This broker isn’t ready for direct pairing. Try again when the broker is available."
        case PairingError.invalidEnrollment:
            "Use an Approver connection to pair this iPhone for requests."
        default:
            VaultModel.message(for: error)
        }
    }
}
