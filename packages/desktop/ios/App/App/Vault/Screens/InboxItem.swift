import SwiftUI

@available(iOS 17.0, *)
struct InboxItem: Identifiable {
    enum Kind {
        case release(BrokerRequest)
        case privateBrowser(PrivateBrowserOffer)
        case vaultAdd(VaultAddSummary)
        case passwordImport(ReviewedPasswordImport)
    }

    let connection: BrokerConnection
    let kind: Kind

    var id: String { "\(connection.id.uuidString)-\(accessibilityID)" }

    var accessibilityID: String {
        switch kind {
        case .release(let request): "\(connection.machine.rawValue)-request-\(request.id)"
        case .privateBrowser(let offer): "\(connection.machine.rawValue)-private-browser-\(offer.requestId)"
        case .vaultAdd(let request): "\(connection.machine.rawValue)-vault-add-\(request.id)"
        case .passwordImport(let request): "\(connection.machine.rawValue)-password-import-\(request.id)"
        }
    }

    @MainActor var milliseconds: Int64 {
        switch kind {
        case .release(let request): connection.releaseClock.remaining(request.expiresAt)
        case .privateBrowser(let offer): connection.remaining(offer)
        case .vaultAdd(let request): connection.remaining(request)
        case .passwordImport(let request): connection.importClock.remaining(request.expiresAt)
        }
    }

    var title: String {
        switch kind {
        case .release(let request): request.approvalOnly == true || request.codeOnly == true ? request.reason : request.service
        case .privateBrowser: "Private browser entry"
        case .vaultAdd(let request): "Add \(request.siteName) login"
        case .passwordImport: "Password import request"
        }
    }

    var subtitle: String {
        switch kind {
        case .release(let request): "\(connection.machine.title) · \(request.action)"
        case .privateBrowser(let offer): "\(connection.machine.title) · \(offer.website)"
        case .vaultAdd(let request): "\(connection.machine.title) · \(request.domain)"
        case .passwordImport(let request): "\(connection.machine.title) · \(request.services.count) entries"
        }
    }
}
