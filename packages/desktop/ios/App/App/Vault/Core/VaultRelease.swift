import Foundation

public enum VaultReleaseError: Error {
    case codeRequired
    case loginRequired
    case websiteMismatch
}

/// What an approval may carry for each kind of request. No UI, storage or biometrics, so it is tested alone.
public struct VaultRelease: Sendable {
    public let request: BrokerRequest
    public let code: String

    public init(request: BrokerRequest, code: String) {
        self.request = request
        self.code = code.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var takesPassword: Bool { request.approvalOnly != true && request.codeOnly != true }

    /// `login` is the saved entry Daniel picked, read after Face ID. `origin` is the broker being answered.
    public func approval(login: VaultEntry?, expiresAt: Int64, origin: String) throws -> BrokerClient.Decision {
        if request.approvalOnly == true {
            guard request.requireServiceOtp != true else { throw BrokerError.invalidRequest }
            return .init(approvingOnly: request, expiresAt: expiresAt)
        }
        let password = try takesPassword ? password(of: login) : nil
        // A deferred sign-in takes its code later, so none travels with the password.
        let otp = code.isEmpty || request.deferredOtp == true ? nil : code
        let requiresOTP = request.codeOnly == true || request.requireServiceOtp == true
            || (request.deferredOtp != true && login?.twoFactorEveryTime == true)
        guard !requiresOTP || otp != nil else { throw VaultReleaseError.codeRequired }
        let sealed = try SecretEnvelope.seal(password: password, otp: otp, to: request)
        return BrokerClient.Decision(
            approving: request, expiresAt: expiresAt, sealed: sealed, otpIncluded: requiresOTP
        ).selecting(request, origin: origin)
    }

    private func password(of login: VaultEntry?) throws -> String {
        guard let login else { throw VaultReleaseError.loginRequired }
        if let bound = request.websiteDomain, login.domain?.lowercased() != bound {
            throw VaultReleaseError.websiteMismatch
        }
        return login.password
    }
}
