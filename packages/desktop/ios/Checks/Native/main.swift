import Foundation

// Native checks of the Harness phone plugins. They run the real Swift of the app on this Mac,
// without a simulator, a relay, a Hub or a keychain: scripts/check-ios-native.ts compiles every
// file of ios/App/App/Remote and ios/App/App/Account except the Capacitor plugins together with
// this folder, once as Debug and once as Release. Nothing here is proof of a connection to a
// real computer or a real Hub.

#if DEBUG
let flavor = "Debug"
#else
let flavor = "Release"
#endif

func policyChecks() {
    check(RemotePolicy.origin("https://relay.example.invalid") != nil, "an https origin of another machine is a relay")
    let refused = [
        "http://relay.example.invalid", "https://relay.example.invalid/", "https://relay.example.invalid/x",
        "https://user@relay.example.invalid", "https://localhost", "https://127.0.0.1:8787", "wss://relay.example.invalid", ""
    ]
    check(refused.allSatisfy { RemotePolicy.origin($0) == nil }, "plain http, a path, user information and this device are refused")
    let local = ["http://127.0.0.1:8787", "http://localhost:8787"]
    #if DEBUG
    RemoteDebug.loopback = false
    check(local.allSatisfy { RemotePolicy.origin($0) == nil }, "Debug without the opt-in refuses a local relay")
    RemoteDebug.loopback = true
    check(local.allSatisfy { RemotePolicy.origin($0) != nil }, "Debug with the opt-in accepts plain http on this machine only")
    check(RemotePolicy.origin("http://relay.example.invalid") == nil, "the opt-in never accepts plain http of another machine")
    RemoteDebug.loopback = false
    #else
    check(local.allSatisfy { RemotePolicy.origin($0) == nil }, "Release refuses a local relay; the opt-in does not exist in it")
    #endif
    let socket = RemotePolicy.origin("https://relay.example.invalid").flatMap { RemotePolicy.socket($0, hostId: "abc") }
    check(socket?.absoluteString == "wss://relay.example.invalid/v1/hosts/abc/connect", "the socket address holds no credential")
}

print("Harness native checks (\(flavor))")
policyChecks()
offerChecks()
scanChecks()
scanLifecycleChecks()
scanHandoffChecks()
attachChecks()
lockChecks()
staleChecks()
revocationChecks()
mutationChecks()
requestChecks()
savedCopyChecks()
mediaChecks()
authorityChecks()
denialChecks()
budgetChecks()
epochChecks()
refusalChecks()
evidenceOfferChecks()
evidenceCopyChecks()
artifactCopyChecks()
evidenceAuthorityChecks()
artifactIntegrityChecks()
artifactKindChecks()
artifactFileChecks()
artifactSizeChecks()
httpRedirectChecks()
socketChecks()
accountPolicyChecks()
accountSignInChecks()
accountBindingChecks()
accountRequestChecks()
accountReuseChecks()
accountHttpChecks()
print("\(flavor): \(passes) passed, \(failures) failed.")
exit(failures == 0 ? 0 : 1)
