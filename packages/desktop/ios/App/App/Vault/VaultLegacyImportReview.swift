import Foundation

struct VaultImportedLogin: Codable {
    struct Identity: Codable {
        let service: String
        let domain: String
        let username: String
    }

    let identity: Identity
    let password: String
}

enum VaultImportFailure: Error {
    case invalidPayload, storage, conflict
}

/// Keeps the reviewed account and the original offer together until the login can be saved.
struct VaultLegacyImportReview {
    struct Offer {
        let binding: VaultLegacyAdd
        let preview: VaultLegacyAdd.ReviewedBox
        let loginDigest: String
    }

    private struct Login: Decodable {
        let username: String
        let password: String?
    }

    let identity: VaultImportedLogin.Identity
    private let offer: Offer

    var expiresAt: Int64 { offer.binding.expiresAt }

    init(_ offer: Offer, to recipient: VaultLegacyAdd.Recipient, now: Int64) throws {
        guard offer.preview.purpose == .preview, offer.loginDigest.utf8.count == 64,
            offer.loginDigest.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) })
        else { throw VaultApprovalFailure.binding }
        let preview = try Self.decode(offer.preview, in: offer.binding, to: recipient, now: now)
        guard preview.password == nil, Self.validUsername(preview.username) else {
            throw VaultImportFailure.invalidPayload
        }
        identity = VaultImportedLogin.Identity(service: offer.binding.service, domain: offer.binding.domain,
                                                username: preview.username)
        self.offer = offer
    }

    func save(
        _ login: VaultLegacyAdd.Box, to recipient: VaultLegacyAdd.Recipient, now: Int64,
        store: (VaultImportedLogin) throws -> Void
    ) throws -> String {
        let reviewed = VaultLegacyAdd.ReviewedBox(purpose: .login, box: login, ciphertextSha256: offer.loginDigest)
        let entry = try Self.decode(reviewed, in: offer.binding, to: recipient, now: now)
        guard entry.username.utf8.elementsEqual(identity.username.utf8), let password = entry.password,
            (1...4096).contains(password.utf8.count)
        else { throw VaultImportFailure.invalidPayload }
        try store(VaultImportedLogin(identity: identity, password: password))
        return offer.binding.addId
    }

    private static func decode(
        _ box: VaultLegacyAdd.ReviewedBox, in binding: VaultLegacyAdd, to recipient: VaultLegacyAdd.Recipient, now: Int64
    ) throws -> Login {
        var bytes = try binding.open(box, to: recipient, now: now)
        defer { bytes.resetBytes(in: bytes.startIndex..<bytes.endIndex) }
        return try JSONDecoder().decode(Login.self, from: bytes)
    }

    private static func validUsername(_ username: String) -> Bool {
        (1...1024).contains(username.utf8.count) && !username.unicodeScalars.contains { scalar in
            CharacterSet.controlCharacters.contains(scalar) || (0x202A...0x202E).contains(scalar.value) ||
                (0x2066...0x2069).contains(scalar.value)
        }
    }
}
