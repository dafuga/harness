import Foundation
import Observation

struct BrokerClock {
    private let serverTime: Int64
    private let receivedAt = ContinuousClock.now

    init() { serverTime = 0 }

    init(serverTime: Int64) throws {
        guard (0...4_102_444_800_000).contains(serverTime) else { throw BrokerError.malformedResponse }
        self.serverTime = serverTime
    }

    var isSynchronized: Bool { serverTime > 0 }

    var now: Int64 {
        let elapsed = receivedAt.duration(to: .now).components
        return serverTime + elapsed.seconds * 1_000 + elapsed.attoseconds / 1_000_000_000_000_000
    }

    func remaining(_ expiresAt: Int64, maximumLifetime: Int64 = 120_000) -> Int64 {
        guard expiresAt > serverTime, expiresAt - serverTime <= maximumLifetime else { return 0 }
        return max(0, expiresAt - now)
    }
}

@MainActor
@Observable
final class BrokerConnection: Identifiable {
    let id = UUID()
    let machine: BrokerMachine
    let fixture: (any DeviceBroker)?
    var stored: StoredBrokerConnection

    var configuration: BrokerConfiguration { stored.configuration }
    var requests: [BrokerRequest] = []
    var adds: [VaultAddSummary] = []
    var attemptedAdds: [String: Int64] = [:]
    var publishImportKeyAfter = ContinuousClock.now
    var imports: [ReviewedPasswordImport] = []
    var attemptedImports: [String: Int64] = [:]
    var importPollIssue: PollFailure?
    var importProbeAfter = ContinuousClock.now
    var releaseClock = BrokerClock()
    var importClock = BrokerClock()
    var knownRequests: [String: Int64] = [:]
    var pollState: RequestPollState = .checking
    var pushRegistration: PushRegistration?
    var retryPushAfter = ContinuousClock.now
    var hasRemoteAlerts: Bool { pushRegistration?.token != nil }
    private(set) var pollGeneration = 0
    private(set) var queueRevision = 0

    init(machine: BrokerMachine, stored: StoredBrokerConnection, fixture: (any DeviceBroker)? = nil) {
        self.machine = machine
        self.stored = stored
        self.fixture = fixture
    }

    func keyAccount(_ account: String) -> String {
        let originHash = BrokerProtocol.fingerprint(Data(configuration.origin.utf8))
        return "\(account)-\(machine.rawValue)-\(originHash)"
    }

    func live(_ request: BrokerRequest) -> Bool {
        releaseClock.remaining(request.expiresAt) > 0 && requests.contains(request)
    }

    func remaining(_ request: VaultAddSummary) -> Int64 {
        releaseClock.remaining(request.expiresAt, maximumLifetime: VaultAddSummary.maximumLifetime)
    }

    func live(_ request: VaultAddSummary) -> Bool {
        remaining(request) > 0 && adds.contains(request)
    }

    func remove(_ request: VaultAddSummary) {
        adds.removeAll { $0.id == request.id }
        queueRevision &+= 1
    }

    func live(_ request: ReviewedPasswordImport) -> Bool {
        importClock.remaining(request.expiresAt) > 0 && imports.contains(request)
    }

    func remove(_ request: BrokerRequest) {
        requests.removeAll { $0.id == request.id }
        queueRevision &+= 1
    }

    func remove(_ request: ReviewedPasswordImport) {
        imports.removeAll { $0.id == request.id }
        queueRevision &+= 1
    }

    func retryPoll() {
        if pollState == .ready { pollState = .checking }
        importProbeAfter = .now
        publishImportKeyAfter = .now
        pollGeneration &+= 1
    }

    func fail(_ failure: PollFailure) {
        requests = []
        adds = []
        imports = []
        importPollIssue = nil
        pollState = .failed(failure)
        queueRevision &+= 1
    }

    func remember(_ id: String, until expiresAt: Int64, now: Int64) -> Bool {
        knownRequests = knownRequests.filter { $0.value > now }
        return knownRequests.updateValue(expiresAt, forKey: id) == nil
    }
}

extension VaultModel {
    func poll(_ connection: BrokerConnection, includeReleaseAlerts: Bool = true) async -> Bool {
        guard isCurrent(connection), connection.configuration.role == .approver, !workInProgress else { return false }
        let scope = PollScope(connection)
        do {
            let api = try client(for: connection)
            let publication = vaultAddPublication(for: connection)
            let pending = try await api.pending(publishing: publication, sign: signer(for: connection))
            guard canApply(scope) else { return false }
            if publication != nil {
                connection.publishImportKeyAfter = ContinuousClock.now.advanced(by: .seconds(30))
            }
            let fresh = try applyReleaseQueue(pending, to: connection)
            let freshAdds = applyVaultAddQueue(pending.adds ?? [], to: connection)
            connection.pollState = .ready
            await retryVaultAddReceipt(using: api, at: connection)
            guard canApply(scope) else { return false }
            let freshImports = await pollImports(api: api, scope: scope)
            return canApply(scope) && ((includeReleaseAlerts && fresh) || freshAdds || freshImports)
        } catch {
            guard canApply(scope) else { return false }
            connection.fail(PollFailure(error))
            return false
        }
    }

    private func applyReleaseQueue(_ pending: BrokerClient.Pending, to connection: BrokerConnection) throws -> Bool {
        connection.releaseClock = try BrokerClock(serverTime: pending.serverTime)
        var seen: Set<String> = []
        connection.requests = pending.requests.filter { request in
            connection.releaseClock.remaining(request.expiresAt) > 0
                && (try? request.verifiedSessionKey()) != nil && seen.insert(request.id).inserted
        }
        return connection.requests.reduce(false) { fresh, request in
            connection.remember("release:\(request.id)", until: request.expiresAt, now: connection.releaseClock.now) || fresh
        }
    }

    private func pollImports(api: any DeviceBroker, scope: PollScope) async -> Bool {
        let connection = scope.connection
        guard ContinuousClock.now >= connection.importProbeAfter else { return false }
        do {
            let pending = try await api.pendingImports(sign: signer(for: connection))
            guard canApply(scope) else { return false }
            connection.importClock = try BrokerClock(serverTime: pending.serverTime)
            connection.attemptedImports = connection.attemptedImports.filter { $0.value > connection.importClock.now }
            var seen: Set<String> = []
            let saved = Set(scopedImportReceipts(for: connection).filter { !$0.isVaultAdd }.map(\.completion.importId))
            let eligible = pending.imports.filter {
                connection.importClock.remaining($0.expiresAt) > 0 && !saved.contains($0.importId)
                    && connection.attemptedImports[$0.importId] == nil
            }
            let reviewed = eligible.compactMap { try? $0.review(for: connection.configuration.deviceID) }
            connection.imports = reviewed.filter { seen.insert($0.id).inserted }
            connection.importPollIssue = eligible.count == reviewed.count ? nil : .broker
            let fresh = connection.imports.reduce(false) { fresh, request in
                connection.remember("import:\(request.id)", until: request.expiresAt, now: connection.importClock.now) || fresh
            }
            await retryImportReceipt(using: api, at: connection)
            return fresh
        } catch BrokerError.http(404) {
            guard canApply(scope) else { return false }
            connection.imports = []
            connection.importPollIssue = nil
            connection.importProbeAfter = ContinuousClock.now.advanced(by: .seconds(30))
        } catch {
            guard canApply(scope) else { return false }
            connection.imports = []
            connection.importPollIssue = PollFailure(error)
            connection.importProbeAfter = ContinuousClock.now.advanced(by: .seconds(6))
        }
        return false
    }

    private func canApply(_ scope: PollScope) -> Bool {
        !Task.isCancelled && !workInProgress && isCurrent(scope.connection)
            && scope.connection.pollGeneration == scope.generation && scope.connection.queueRevision == scope.revision
    }

    private struct PollScope {
        let connection: BrokerConnection
        let generation: Int
        let revision: Int

        @MainActor init(_ connection: BrokerConnection) {
            self.connection = connection
            generation = connection.pollGeneration
            revision = connection.queueRevision
        }
    }
}
