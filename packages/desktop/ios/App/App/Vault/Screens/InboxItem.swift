import SwiftUI

struct InboxItem: Identifiable {
    enum Kind {
        case release(BrokerRequest)
        case vaultAdd(VaultAddSummary)
        case passwordImport(ReviewedPasswordImport)
    }

    let connection: BrokerConnection
    let kind: Kind

    var id: String { "\(connection.id.uuidString)-\(accessibilityID)" }

    var accessibilityID: String {
        switch kind {
        case .release(let request): "\(connection.machine.rawValue)-request-\(request.id)"
        case .vaultAdd(let request): "\(connection.machine.rawValue)-vault-add-\(request.id)"
        case .passwordImport(let request): "\(connection.machine.rawValue)-password-import-\(request.id)"
        }
    }

    @MainActor var milliseconds: Int64 {
        switch kind {
        case .release(let request): connection.releaseClock.remaining(request.expiresAt)
        case .vaultAdd(let request): connection.remaining(request)
        case .passwordImport(let request): connection.importClock.remaining(request.expiresAt)
        }
    }

    var title: String {
        switch kind {
        case .release(let request): request.approvalOnly == true || request.codeOnly == true ? request.reason : request.service
        case .vaultAdd(let request): "Add \(request.siteName) login"
        case .passwordImport: "Password import request"
        }
    }

    var subtitle: String {
        switch kind {
        case .release(let request): "\(connection.machine.title) · \(request.action)"
        case .vaultAdd(let request): "\(connection.machine.title) · \(request.domain)"
        case .passwordImport(let request): "\(connection.machine.title) · \(request.services.count) entries"
        }
    }
}
