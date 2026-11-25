import Foundation

// Live interop of the Swift sealed layer with packages/remote (@hpke/core, WebCrypto): the
// driver scripts/check-ios-sealed-interop.ts runs `export`, lets TypeScript judge what Swift
// made and make its own, then runs `verify`. The device keys of this Mac's Secure Enclave
// travel between the two runs as an opaque blob in a temporary folder. Not part of the app.

var failures = 0
func check(_ passed: Bool, _ name: String) {
    print("\(passed ? "ok  " : "FAIL") \(name)")
    if !passed { failures += 1 }
}

guard CommandLine.arguments.count > 2 else {
    print("usage: sealed-interop export|verify <folder>")
    exit(2)
}
let folder = URL(fileURLWithPath: CommandLine.arguments[2])
guard #available(iOS 17.0, macOS 14.0, *) else { exit(0) }
do {
    switch CommandLine.arguments[1] {
    case "export": try InteropExport(folder: folder).run()
    case "verify": try InteropVerify(folder: folder).run()
    default: print("unknown mode"); exit(2)
    }
} catch {
    print("FAIL \(error)")
    exit(1)
}
exit(failures == 0 ? 0 : 1)
