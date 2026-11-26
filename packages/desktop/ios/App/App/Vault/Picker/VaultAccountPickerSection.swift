import SwiftUI

/// The saved logins for the requested site. Selecting one releases nothing; approval still needs Face ID.
struct VaultAccountPickerSection: View {
    let match: VaultAccountMatch
    let site: String
    let requestedAccount: String?
    @Binding var selection: UUID?

    var body: some View {
        Section {
            ForEach(match.offered) { entry in
                Button { selection = entry.id } label: { row(entry) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("vault-account-\(entry.service)")
                    .accessibilityAddTraits(selection == entry.id ? .isSelected : [])
            }
        } header: {
            Text("Saved logins for \(site)")
        } footer: {
            if let note { Text(note) }
        }
        .onAppear { if selection == nil { selection = match.preselection } }
    }

    private var note: String? {
        guard case .choose(_, true) = match, let requestedAccount else { return nil }
        return "The request names \(requestedAccount), and no saved login has that username. "
            + "Pick one only if it is the same account."
    }

    private func source(_ entry: VaultAccountCandidate) -> String {
        guard let domain = entry.domain, domain != entry.service else { return entry.service }
        return "\(entry.service) · \(domain)"
    }

    private func row(_ entry: VaultAccountCandidate) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.username.isEmpty ? "No username saved" : entry.username)
                    .foregroundStyle(.primary)
                Text(source(entry))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if selection == entry.id {
                Image(systemName: "checkmark").foregroundStyle(.tint).accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }
}
