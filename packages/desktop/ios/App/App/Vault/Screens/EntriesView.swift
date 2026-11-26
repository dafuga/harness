import SwiftUI

struct EntriesView: View {
    let model: VaultModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var editing: VaultEntry?
    @State private var deleting: EntryLabel?

    var body: some View {
        NavigationStack {
            Group {
                if model.entries.isEmpty {
                    ContentUnavailableView("Your vault is empty", systemImage: "lock",
                        description: Text("Add a credential using the service name your broker requests."))
                } else {
                    List(model.entries) { label in
                        Button {
                            Task {
                                if let entry = await model.read(label), scenePhase != .background {
                                    editing = entry
                                }
                            }
                        } label: {
                            Label(label.service, systemImage: "lock")
                        }
                        .swipeActions {
                            Button("Delete", role: .destructive) { deleting = label }
                        }
                    }
                }
            }
            .navigationTitle("Vault")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Add entry", systemImage: "plus") {
                        editing = VaultEntry(service: "", username: "", password: "")
                    }
                    .accessibilityIdentifier("add-entry")
                }
            }
            .sheet(item: $editing) { entry in
                EntryEditor(model: model, entry: entry)
            }
            .confirmationDialog("Delete this vault entry?", isPresented: Binding(
                get: { deleting != nil },
                set: { if !$0 { deleting = nil } }
            ), presenting: deleting) { label in
                Button("Delete", role: .destructive) { Task { await model.delete(label) } }
                    .accessibilityIdentifier("confirm-delete-entry")
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                editing = nil
                deleting = nil
            }
        }
    }
}

struct EntryEditor: View {
    let model: VaultModel
    @State private var entry: VaultEntry
    private let lockService: Bool
    private let lockAccount: Bool
    @Environment(\.dismiss) private var dismiss

    init(model: VaultModel, entry: VaultEntry, lockService: Bool = false, lockAccount: Bool = false) {
        self.model = model
        _entry = State(initialValue: entry)
        self.lockService = lockService
        self.lockAccount = lockAccount
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Credential") {
                    ProtectedField("Service", text: $entry.service).frame(minHeight: 28).disabled(lockService)
                    ProtectedField("Username", text: $entry.username).frame(minHeight: 28).disabled(lockAccount)
                    ProtectedField("Password", text: $entry.password, secure: true).frame(minHeight: 28)
                }
                Section {
                    Toggle("2FA every time", isOn: $entry.twoFactorEveryTime)
                        .accessibilityIdentifier("entry-two-factor-every-time")
                } footer: {
                    Text("Require a fresh verification code and phone approval for every request for this entry.")
                }
                Section("Optional") {
                    ProtectedField("Notes", text: $entry.notes).frame(minHeight: 28)
                }
            }
            .navigationTitle("Vault entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            entry.service = entry.service.trimmingCharacters(in: .whitespacesAndNewlines)
                            if await model.save(entry) { dismiss() }
                        }
                    }
                    .disabled(model.workInProgress || entry.service.isEmpty || entry.password.isEmpty)
                }
            }
            .interactiveDismissDisabled(model.workInProgress)
        }
        .onDisappear { entry = VaultEntry(service: "", username: "", password: "") }
    }
}
