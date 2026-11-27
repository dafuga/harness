import Foundation

/// Where a check keeps an account session: memory only.
final class MemoryLoginDeviceKeys: SealedSecretStore {
    private var values: [String: Data] = [:]
    func load(_ name: String) -> Data? { values[name] }
    func save(_ name: String, _ data: Data) throws { values[name] = data }
    func remove(_ name: String) { values.removeValue(forKey: name) }
}

final class MemoryAccountVault: HubAccountVault {
    let deviceKeys = MemoryLoginDeviceKeys()
    var firstDeviceReplies: [String: [String: HubAccountReply]] = [:]
    var credential: HubAccountCredential?
    var wipes = 0
    init(_ credential: HubAccountCredential? = nil) { self.credential = credential }
    func load() -> HubAccountCredential? { credential }
    func save(_ credential: HubAccountCredential) throws {
        var kept = credential
        if kept.installationBinding == nil { kept.installationBinding = UUID() }
        self.credential = kept
    }
    func wipe() {
        credential = nil
        wipes += 1
    }
}

func accountInstallationChecks(_ hubKept: HubAccountCredential) {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    var legacy = hubKept
    legacy.installationBinding = nil
    let item = MemoryAccountVault(legacy)
    let vault = HubAccountKeychain(item: item, directory: directory)
    check(vault.load() == nil, "account installation: a session without an installation binding requires login")
    do {
        try vault.save(hubKept)
        let relaunched = HubAccountKeychain(item: item, directory: directory)
        check(relaunched.load()?.subject == hubKept.subject, "account installation: relaunch keeps the login")
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
        let reinstalled = HubAccountKeychain(item: item, directory: directory)
        check(reinstalled.load() == nil && item.credential != nil,
              "account installation: reinstall with the former keychain item requires login")
        try reinstalled.save(hubKept)
        reinstalled.wipe()
        check(reinstalled.load() == nil, "account installation: explicit sign-out clears the login")
    } catch { check(false, "account installation: disposable session storage works") }
}
