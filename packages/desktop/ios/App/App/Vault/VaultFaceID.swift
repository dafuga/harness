import LocalAuthentication

enum VaultFaceID {
    enum Failure: Error { case unavailableOrDenied }

    static func authenticate(_ reason: String) async throws -> LAContext {
        let context = LAContext()
        context.localizedFallbackTitle = ""
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil),
            context.biometryType == .faceID,
            (try? await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                               localizedReason: reason)) == true
        else {
            context.invalidate()
            throw Failure.unavailableOrDenied
        }
        return context
    }
}
