import CryptoKit
import Foundation
import LocalAuthentication
import Observation

@available(iOS 17.0, *)
@MainActor
protocol DeviceBroker {
    func pending(publishing key: VaultAddKeyPublication?, sign: BrokerClient.Sign) async throws -> BrokerClient.Pending
    func decide(_ decision: BrokerClient.Decision, sign: BrokerClient.Sign) async throws
    func decideVaultAdd(_ decision: VaultAddDecision, sign: BrokerClient.Sign) async throws -> VaultAddDelivery?
    func privateBrowserOffer(sign: BrokerClient.Sign) async throws -> PrivateBrowserOffer?
    func submitPrivateBrowserField(
        _ value: String, for offer: PrivateBrowserOffer, sign: BrokerClient.Sign
    ) async throws -> Bool
    func pendingImports(sign: BrokerClient.Sign) async throws -> BrokerClient.PendingImports
    func decideImport(_ decision: PasswordImportDecision, sign: BrokerClient.Sign) async throws -> PasswordImportDelivery?
    func completeImport(_ completion: PasswordImportCompletion, sign: BrokerClient.Sign) async throws
    func upload(_ blob: Data, recipientID: String, sign: BrokerClient.Sign) async throws
    func download(sign: BrokerClient.Sign) async throws -> Data
}

@available(iOS 17.0, *)
extension BrokerClient: DeviceBroker {}

@available(iOS 17.0, *)
@MainActor
@Observable
final class VaultModel {
    let keychain: Keychain
    let keys: DeviceKeys
    let vault: any VaultStorage
    let authenticate: (String) async throws -> LAContext
    let fixtureSign: BrokerClient.Sign?
    var connections: [BrokerConnection]
    var importReceipts: [StoredImportReceipt] = []
    var entries: [EntryLabel] = []
    var error: String?
    var workInProgress = false

    init(
        vault: (any VaultStorage)? = nil,
        authenticate: ((String) async throws -> LAContext)? = nil,
        fixtureConnections: [BrokerConnection]? = nil,
        fixtureSign: BrokerClient.Sign? = nil
    ) {
        let keychain = Keychain()
        let keys = DeviceKeys(keychain: keychain)
        self.keychain = keychain
        self.keys = keys
        self.vault = vault ?? VaultStore(keychain: keychain, keys: keys)
        self.authenticate = authenticate ?? keys.authenticate
        self.fixtureSign = fixtureSign
        connections = fixtureConnections ?? []
        if fixtureConnections == nil { loadConnections() }
        do {
            try loadEntries()
        } catch {
            self.error = "Couldn’t open the vault settings. Unlock your device and reopen the app."
        }
    }

    func accounts(for request: BrokerRequest) -> VaultAccountMatch {
        .resolve(service: request.service, site: request.site ?? request.websiteDomain,
                 account: request.account, entries: entries.map(\.candidate))
    }

    /// Only a login still offered for this request can be released.
    func entry(_ id: UUID?, for request: BrokerRequest) -> EntryLabel? {
        guard let id, accounts(for: request).offered.contains(where: { $0.id == id }) else { return nil }
        return entries.first { $0.id == id }
    }

    /// A deferred sign-in sends only the password; its code is asked for by a later request.
    func requiresServiceOTP(for request: BrokerRequest, entry id: UUID? = nil) -> Bool {
        if request.codeOnly == true { return true }
        return request.approvalOnly != true && request.deferredOtp != true
            && (request.requireServiceOtp == true || entry(id, for: request)?.twoFactorEveryTime == true)
    }

    func isCurrent(_ connection: BrokerConnection) -> Bool {
        connections.contains { $0 === connection }
    }

    func client(for connection: BrokerConnection) throws -> any DeviceBroker {
        guard isCurrent(connection) else { throw DeviceVaultError.invalidConfiguration }
        if let fixture = connection.fixture { return fixture }
        return try connection.configuration.client()
    }

    func retryPoll() {
        connections.forEach { $0.retryPoll() }
    }

    func signer(for connection: BrokerConnection) -> BrokerClient.Sign {
        { input in
            guard self.isCurrent(connection) else { throw DeviceVaultError.invalidConfiguration }
            if let fixtureSign = self.fixtureSign { return try fixtureSign(input) }
            return try self.keys.signingKey(for: connection).signature(for: input).rawRepresentation
        }
    }

    func loadEntries() throws {
        entries = try vault.labels().sorted { $0.service.localizedStandardCompare($1.service) == .orderedAscending }
        importReceipts = try vault.importReceipts()
    }

    @discardableResult
    func perform(at connection: BrokerConnection? = nil, _ operation: () async throws -> Void) async -> Bool {
        guard !workInProgress else { return false }
        workInProgress = true
        defer { workInProgress = false }
        do {
            try await operation()
            return true
        } catch let failure as LAError where [.userCancel, .systemCancel, .appCancel].contains(failure.code) {
            return false
        } catch {
            let failure = PollFailure(error)
            if let connection, failure.isOffline {
                connection.fail(failure)
            } else {
                self.error = Self.message(for: error)
            }
            return false
        }
    }
}
