import Foundation
import LocalAuthentication

/// A single Electron login owns this process and its private stdin/stdout pipe.
@main
enum HarnessMacDeviceApproval {
    static func main() {
        if CommandLine.arguments == [CommandLine.arguments[0], "--version"] {
            print("1")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            serve()
            exit(0)
        }
        dispatchMain()
    }

    private static func serve() {
        guard let login = read(), let session = session(login) else { return reply(.failure(.refused)) }
        reply(.success(["state": "ready"]))
        while let command = read() {
            let finished = DispatchSemaphore(value: 0)
            execute(command, session: session) {
                reply($0)
                finished.signal()
            }
            finished.wait()
        }
    }

    private static func read() -> [String: Any]? {
        guard let line = readLine(), line.utf8.count <= 4096 else { return nil }
        return RemoteCoding.object(Data(line.utf8))
    }

    private static func session(_ input: [String: Any]) -> HubAccountSession? {
        guard input["action"] as? String == "start", let origin = HubAccountPolicy.origin(input["origin"]),
            let actor = input["actor"] as? [String: String], let subject = actor["id"], !subject.isEmpty,
            let token = input["token"] as? String, HubAccountPolicy.matches(token, "\\A[A-Za-z0-9_-]{43}\\z"),
            let binding = input["installationBinding"] as? String, let id = UUID(uuidString: binding)
        else { return nil }
        let credential = HubAccountCredential(origin: origin.absoluteString, subject: subject,
            name: actor["name"] ?? "", email: actor["email"] ?? "",
            token: token, expiresAt: .distantFuture, installationBinding: id)
        let session = HubAccountSession(origin: origin, vault: PipeAccountVault(credential))
        session.enrollmentPlatform = .mac
        return session
    }

    private static func execute(_ command: [String: Any], session: HubAccountSession, done: @escaping HubAccountSession.Status) {
        guard let action = command["action"] as? String else { return done(.failure(.refused)) }
        if action == "status" { return session.status(done) }
        if action == "list" { return session.approvalRequests(done) }
        guard let id = command["id"] as? String else { return done(.failure(.refused)) }
        switch action {
        case "review": session.reviewApproval(id, done: done)
        case "deny": session.denyDevice(id, done: done)
        case "approve":
            guard let code = command["code"] as? String else { return done(.failure(.refused)) }
            session.approveDevice(id, code: code, authenticate: authenticate, done: done)
        default: done(.failure(.refused))
        }
    }

    private static func authenticate(_ done: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            let context = LAContext()
            context.touchIDAuthenticationAllowableReuseDuration = 0
            context.evaluatePolicy(.deviceOwnerAuthentication,
                                   localizedReason: "Approve the device with the matching code.") { accepted, _ in
                context.invalidate()
                done(accepted)
            }
        }
    }

    private static func reply(_ result: Result<[String: Any], HubAccountFailure>) {
        let body: [String: Any]
        switch result {
        case .success(let value): body = ["value": value]
        case .failure(let failure): body = ["error": failure.code]
        }
        guard let data = RemoteCoding.json(body) else { return }
        FileHandle.standardOutput.write(data + Data([10]))
    }
}

/// Electron already owns token persistence. The helper retains it only while the pipe is open.
private final class PipeAccountVault: HubAccountVault {
    private var credential: HubAccountCredential?
    init(_ credential: HubAccountCredential) { self.credential = credential }
    func load() -> HubAccountCredential? { credential }
    func save(_ credential: HubAccountCredential) throws { throw HubAccountFailure.refused }
    func wipe() { credential = nil }
}
