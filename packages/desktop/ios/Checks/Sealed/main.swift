import Foundation

// Known-answer checks of the Swift sealed layer against the frozen vectors of packages/remote
// (test/support/sealed-vectors.json), then the behaviours around them: tamper refusals, Secure
// Enclave keys and the device chain. Compiled for macOS with the Sealed/ sources and RemoteCoding
// by scripts/check-ios-sealed.ts; not part of the app.

var failures = 0
func check(_ passed: Bool, _ name: String) {
    print("\(passed ? "ok  " : "FAIL") \(name)")
    if !passed { failures += 1 }
}
func refuses(_ name: String, _ body: () throws -> Void) {
    do {
        try body()
        check(false, name)
    } catch {
        check(true, name)
    }
}

guard CommandLine.arguments.count > 1,
    let file = try? Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])),
    let root = RemoteCoding.object(file)
else {
    print("FAIL the vectors could not be read")
    exit(2)
}

let vectors = SealedVectors(root: root)
vectors.checkKeysAndRecords()
vectors.checkFramesAndEnrollment()
vectors.checkChainEntryAndGrant()
checkPadding()
checkDeviceKeys()
checkChainRules()

print(failures == 0 ? "all sealed checks passed" : "\(failures) sealed checks failed")
exit(failures == 0 ? 0 : 1)
