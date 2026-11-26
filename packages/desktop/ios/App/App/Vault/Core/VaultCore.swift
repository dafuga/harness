import Foundation

public enum VaultError: Error {
    case invalidEntry
    case invalidCiphertext
}

public struct VaultEntry: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var service: String
    public var domain: String?
    public var username: String
    public var password: String
    public var notes: String
    public var twoFactorEveryTime: Bool

    /// Notes and the every-time verification flag start empty and are set on the value afterwards.
    public init(id: UUID = UUID(), service: String, username: String, password: String) {
        self.id = id
        self.service = service
        self.username = username
        self.password = password
        notes = ""
        twoFactorEveryTime = false
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        service = try values.decode(String.self, forKey: .service)
        domain = try values.decodeIfPresent(String.self, forKey: .domain)
        username = try values.decode(String.self, forKey: .username)
        password = try values.decode(String.self, forKey: .password)
        notes = try values.decode(String.self, forKey: .notes)
        twoFactorEveryTime = try values.decodeIfPresent(Bool.self, forKey: .twoFactorEveryTime) ?? false
    }

    public func validate() throws {
        guard !service.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              service.utf8.count <= 256, username.utf8.count <= 1_024,
              !password.isEmpty, password.utf8.count <= 4_096, notes.utf8.count <= 8_192,
              !service.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains) else {
            throw VaultError.invalidEntry
        }
    }
}
