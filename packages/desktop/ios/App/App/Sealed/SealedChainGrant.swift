import CryptoKit
import Foundation

@available(iOS 17.0, macOS 14.0, *)
extension SealedChainState {
    /// Opens a grant for this device. The keys must match the commitment the verified chain
    /// records for that scope and epoch, so a server cannot slip in keys of its own.
    func openGrant(_ grant: SealedGrant, as device: SealedDevice) throws -> SealedScopeKeys {
        guard grant.account == account, grant.device == device.deviceId else {
            throw SealedError("Grant is for another account or device.")
        }
        guard devices[device.deviceId]?.active == true,
            devices[device.deviceId]?.scopes.contains(grant.scope) == true
        else { throw SealedError("Chain does not grant this scope to this device.") }
        guard let commitment = scopes[grant.scope]?.commitments[grant.epoch] else {
            throw SealedError("Chain has no such scope epoch.")
        }
        let keys = try SealedScopeKeys(try SealedGrantCrypto.open(grant, with: device.kem))
        guard RemoteCoding.base64url(keys.commitment) == commitment else {
            throw SealedError("Grant keys do not match the chain.")
        }
        return keys
    }
}
