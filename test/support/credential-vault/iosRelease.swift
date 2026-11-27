import CryptoKit
import Foundation

/// Test driver: builds the phone's approval for one queued request and prints it. Synthetic data only.
private struct Command: Decodable {
    struct Login: Decodable {
        let domain: String?
        let password: String
        let twoFactorEveryTime: Bool?
    }

    let request: BrokerRequest
    let login: Login?
    let code: String?
    let expiresAt: Int64
    let origin: String

    var entry: VaultEntry? {
        login.map {
            var entry = VaultEntry(service: request.service, username: "sample-user", password: $0.password)
            entry.domain = $0.domain
            entry.twoFactorEveryTime = $0.twoFactorEveryTime ?? false
            return entry
        }
    }
}

@main
struct ReleaseDriver {
    static func main() throws {
        let input = FileHandle.standardInput.readDataToEndOfFile()
        if CommandLine.arguments.contains("--stored-hints") { return try storedHints() }
        let command = try JSONDecoder().decode(Command.self, from: input)
        do {
            let release = VaultRelease(request: command.request, code: command.code ?? "")
            let decision = try release.approval(
                login: command.entry, expiresAt: command.expiresAt, origin: command.origin)
            FileHandle.standardOutput.write(try JSONEncoder().encode(decision))
        } catch {
            print("{\"refused\":\"\(error)\"}")
        }
    }

    /// The username and website kept outside the seal must be the ones sealed inside it.
    private static func storedHints() throws {
        var entry = VaultEntry(service: "github", username: "sample-user", password: "synthetic")
        entry.domain = "github.com"
        let key = P256.KeyAgreement.PrivateKey()
        let record = try VaultCiphertext.seal(entry, to: key.publicKey)
        let stored = String(decoding: try JSONEncoder().encode(record), as: UTF8.self)
        func opens(_ text: String) -> Bool {
            guard let value = try? JSONDecoder().decode(VaultCiphertext.self, from: Data(text.utf8)) else {
                return false
            }
            return (try? value.open { try key.sharedSecretFromKeyAgreement(with: $0) }) != nil
        }
        let result = [
            "username": record.username == "sample-user",
            "domain": record.domain == "github.com",
            "untouched": opens(stored),
            "otherUsername": opens(stored.replacingOccurrences(of: "sample-user", with: "other-user")),
            "otherDomain": opens(stored.replacingOccurrences(of: "github.com", with: "evil.example")),
        ]
        FileHandle.standardOutput.write(try JSONEncoder().encode(result))
    }
}
