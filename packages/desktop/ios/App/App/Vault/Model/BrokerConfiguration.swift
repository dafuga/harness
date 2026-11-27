import CryptoKit
import Foundation

@available(iOS 17.0, *)
enum DeviceRole: String, Codable, CaseIterable {
    case approver
    case recovery
}

@available(iOS 17.0, *)
struct BrokerMachine: Codable, Equatable, Identifiable {
    let rawValue: String
    let title: String
    let origin: String

    var id: String { rawValue }

    static func paired(title: String, origin: String) -> Self {
        let digest = BrokerProtocol.fingerprint(Data(origin.utf8))
        return Self(rawValue: "paired-\(digest)", title: title, origin: origin)
    }

    static func endpoint(of origin: String) -> String? {
        guard let url = try? BrokerProtocol.origin(origin), let host = url.host else { return nil }
        return "\(host.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))):\(url.port ?? 443)"
    }
}

@available(iOS 17.0, *)
struct BrokerConfiguration: Codable, Equatable {
    var origin = ""
    var deviceID = "harness-iphone"
    var role = DeviceRole.approver
    func validate() throws {
        _ = try BrokerProtocol.origin(origin)
        guard BrokerProtocol.validDeviceID(deviceID) else { throw DeviceVaultError.invalidConfiguration }
    }

    func client() throws -> BrokerClient {
        try validate()
        return try BrokerClient(origin: origin, deviceID: deviceID)
    }
}

@available(iOS 17.0, *)
struct StoredBrokerConnection: Codable {
    let configuration: BrokerConfiguration
}

@available(iOS 17.0, *)
struct PairedBrokerConnection: Codable {
    static let keychainAccount = "broker-paired-connections"
    let machine: BrokerMachine
    let stored: StoredBrokerConnection
}

@available(iOS 17.0, *)
struct PublicEnrollment: Identifiable {
    let id = UUID()
    let machine: BrokerMachine
    let signingKey: String
    let recoveryKey: String
    let signingFingerprint: String
    let recoveryFingerprint: String
}

@available(iOS 17.0, *)
struct RecoveryPeer: Codable, Equatable {
    var deviceID = ""
    var key = ""
    var fingerprint = ""

    func verifiedKey() throws -> Data {
        guard BrokerProtocol.validDeviceID(deviceID) else { throw DeviceVaultError.invalidConfiguration }
        let data = try BrokerProtocol.decode(key, size: 65)
        guard BrokerProtocol.fingerprint(data) == fingerprint else { throw DeviceVaultError.invalidConfiguration }
        return data
    }
}
