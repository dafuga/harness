import LocalAuthentication

enum EnrollBiometrics {
    /// One fresh biometric decision per reviewed action. A locked, unavailable, denied or
    /// cancelled biometric request produces no signature.
    static func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        context.touchIDAuthenticationAllowableReuseDuration = 0
        context.localizedFallbackTitle = ""
        defer { context.invalidate() }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { accepted, _ in
                continuation.resume(returning: accepted)
            }
        }
    }
}
