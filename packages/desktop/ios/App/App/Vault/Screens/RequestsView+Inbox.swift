import SwiftUI

@available(iOS 17.0, *)
extension RequestsView {
    func inbox(_ connections: [BrokerConnection]) -> some View {
        let pending = pendingItems(connections)
        return List {
            Section("Brokers") {
                ForEach(connections) { connection in
                    brokerStatus(connection)
                }
            }
            Section("Pending requests") {
                ForEach(pending) { item in
                    pendingRow(item)
                }
                if pending.isEmpty {
                    emptyPending(connections)
                }
            }
            ForEach(connections) { connection in
                if let receipt = model.scopedImportReceipts(for: connection).last {
                    importReceipt(receipt, at: connection)
                }
            }
        }
        .refreshable { model.retryPoll() }
    }

    private func pendingItems(_ connections: [BrokerConnection]) -> [InboxItem] {
        connections.flatMap { connection -> [InboxItem] in
            let releases = connection.requests.filter(connection.live).map {
                InboxItem(connection: connection, kind: .release($0))
            }
            let adds = connection.adds.filter(connection.live).map {
                InboxItem(connection: connection, kind: .vaultAdd($0))
            }
            let imports = connection.imports.filter(connection.live).map {
                InboxItem(connection: connection, kind: .passwordImport($0))
            }
            let privateEntry = connection.privateOffer.flatMap { offer in
                connection.live(offer) ? InboxItem(connection: connection, kind: .privateBrowser(offer)) : nil
            }
            return releases + adds + imports + [privateEntry].compactMap { $0 }
        }.sorted { $0.milliseconds < $1.milliseconds }
    }

    private func pendingRow(_ item: InboxItem) -> some View {
        Button { reviewing = item } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.headline)
                    Text(item.subtitle).foregroundStyle(.secondary)
                }
                Spacer()
                Text("\((item.milliseconds + 999) / 1_000)s")
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(item.accessibilityID)
    }

    @ViewBuilder
    private func emptyPending(_ connections: [BrokerConnection]) -> some View {
        if connections.contains(where: { $0.pollState == .checking }) {
            VStack(spacing: 6) {
                ProgressView()
                    .accessibilityHidden(true)
                Text("Checking for requests")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
        } else if connections.contains(where: { $0.pollState == .ready }) {
            Text("No pending requests").foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func brokerStatus(_ connection: BrokerConnection) -> some View {
        LabeledContent(connection.machine.title) {
            HStack {
                Text(connection.pollState.statusLabel)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("broker-status-\(connection.machine.rawValue)")
                if connection.pollState.hasFailure {
                    Button("Retry \(connection.machine.title)", systemImage: "arrow.clockwise", action: connection.retryPoll)
                        .labelStyle(.iconOnly)
                        .buttonStyle(.borderless)
                }
            }
        }
        if case .failed(let failure) = connection.pollState, !failure.isOffline {
            Text(failure.message)
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else if let issue = connection.importPollIssue {
            Text(issue.isOffline ? "Imports offline" : "Couldn’t check password imports")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func importReceipt(_ receipt: StoredImportReceipt, at connection: BrokerConnection) -> some View {
        let isLogin = receipt.isVaultAdd
        return Section("\(isLogin ? "Latest login" : "Latest import") · \(connection.machine.title)") {
            Label(isLogin ? "Login saved" : (receipt.confirmed ? "Password import confirmed" : "Password import saved"),
                  systemImage: receipt.confirmed ? "checkmark.seal" : "checkmark.circle")
            if !receipt.confirmed {
                Text(receipt.expiresAt > .now
                     ? "Waiting for the broker to confirm \(receipt.count) saved entries."
                     : "The broker didn’t confirm receipt. The entries are saved on this iPhone.")
                    .foregroundStyle(.secondary)
            }
        }
    }
}
