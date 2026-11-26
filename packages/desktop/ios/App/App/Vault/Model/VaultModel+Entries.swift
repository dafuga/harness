import LocalAuthentication

extension VaultModel {
    func read(_ label: EntryLabel) async -> VaultEntry? {
        var entry: VaultEntry?
        await perform {
            let context = try await authenticate("Open this vault entry")
            defer { context.invalidate() }
            entry = try vault.read(label.id, context: context)
        }
        return entry
    }

    func save(_ entry: VaultEntry) async -> Bool {
        await perform {
            let context = try await authenticate("Save this vault entry")
            defer { context.invalidate() }
            try vault.save(entry, context: context)
            try loadEntries()
        }
    }

    func delete(_ label: EntryLabel) async {
        await perform {
            let context = try await authenticate("Delete this vault entry")
            defer { context.invalidate() }
            try vault.delete(label.id)
            try loadEntries()
        }
    }
}
