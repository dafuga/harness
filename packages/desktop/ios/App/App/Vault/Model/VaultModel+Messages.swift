import CryptoKit
import Foundation
import LocalAuthentication

@available(iOS 17.0, *)
extension VaultModel {
    static func message(for error: Error) -> String {
        deviceMessage(for: error) ?? brokerMessage(for: error) ?? transferMessage(for: error)
            ?? "The vault couldn’t complete this operation."
    }

    private static func deviceMessage(for error: Error) -> String? {
        switch error {
        case DeviceVaultError.faceIDUnavailable:
            return "Set up Face ID on this iPhone or Touch ID on a recovery Mac."
        case DeviceVaultError.authentication, is LAError:
            return "Biometric authentication didn’t complete. Try again."
        case DeviceVaultError.missingEntry:
            return "That vault entry is no longer saved."
        case VaultReleaseError.loginRequired:
            return "Choose a saved login for this request."
        case DeviceVaultError.duplicateBroker:
            return "Use a different HTTPS origin for each machine."
        case DeviceVaultError.duplicateBrokerDevice:
            return "Use a different device ID for each machine."
        case VaultReleaseError.codeRequired:
            return "Enter a fresh verification code for this request."
        case DeviceVaultError.duplicateService:
            return "A vault entry already uses this service name."
        case VaultReleaseError.websiteMismatch:
            return "This password is only released to its own website. Set the saved login’s website to the one requested."
        case DeviceVaultError.missingKey:
            return "This device’s key is unavailable. Check enrollment or recover on a trusted second device."
        case DeviceVaultError.keychain:
            return "Couldn’t access protected storage. Unlock your device and try again."
        default:
            return nil
        }
    }

    private static func brokerMessage(for error: Error) -> String? {
        switch error {
        case BrokerError.invalidOrigin:
            return "Enter an HTTPS origin without a path or trailing slash."
        case BrokerError.invalidDevice, DeviceVaultError.invalidConfiguration:
            return "Check the device ID and public-key fingerprint."
        case BrokerError.invalidCredential, VaultError.invalidEntry:
            return "Check the required fields and shorten any oversized values."
        case BrokerError.privateEntryUnavailable:
            return "The browser could not verify completion. Open a fresh request to try again."
        case BrokerError.expired, BrokerError.http(409):
            return "This request is no longer pending. Ask the session to request again."
        case BrokerError.routeProtected, BrokerError.http(301...399):
            return "This address isn’t accepting signed phone requests. Check the broker address."
        case BrokerError.serverUnreachable:
            return error.localizedDescription
        case BrokerError.http(401), BrokerError.http(403):
            return "Check this device’s enrollment and role."
        case BrokerError.http(404):
            return "The broker has no matching request or backup for this device."
        case BrokerError.http(429):
            return "The broker asked the app to slow down. Try again in a moment."
        case BrokerError.http(413), BackupError.tooLarge:
            return "This vault exceeds the broker’s backup size limit."
        case is URLError, BrokerError.transport, BrokerError.http:
            return "Couldn’t reach the broker. Check the HTTPS connection and try again."
        default:
            return nil
        }
    }

    private static func transferMessage(for error: Error) -> String? {
        switch error {
        case BackupError.verificationRequired:
            return "Enter the backup verification code obtained from the source device."
        case BackupError.stale:
            return "This backup is older than a snapshot you already restored."
        case VaultAddError.invalidRequest, VaultAddError.invalidEnvelope:
            return "This login couldn’t be verified. Ask the paired computer to send it again."
        case VaultAddError.reviewExpired:
            return "Unlock the account review again before adding this login."
        case PasswordImportError.serviceConflict:
            return "This import repeats a service or matches an existing vault entry. Nothing was overwritten."
        case PasswordImportError.recipientKeyMismatch:
            return "The import was sealed for a different key. Verify this iPhone’s import key with the broker."
        case PasswordImportError.deliveryInterrupted:
            return "The bundle could not be received. Ask Grok Bot to send a fresh import request."
        case PasswordImportError.invalidBundle, PasswordImportError.invalidManifest:
            return "The password bundle didn’t match the reviewed import."
        case BackupError.invalid, VaultError.invalidCiphertext, is CryptoKitError:
            return "The encrypted data couldn’t be verified with this device’s keys."
        default:
            return nil
        }
    }
}
