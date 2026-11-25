import Foundation

/// Signed-in transport held entirely on the native side. A change of session invalidates the
/// client, including when the same user signs in again.
struct EnrollHub {
    enum Route {
        case chain(Int64), grants(String), pending, enrollment(String), changes, object(String, String)

        var path: String {
            switch self {
            case .chain: return "chain"
            case .grants: return "grants"
            case .pending: return "enroll"
            case .enrollment(let id): return "enroll/" + id
            case .changes: return "devices"
            case .object(let scope, let id): return "objects/" + scope + "/" + id
            }
        }

        var query: [String: String] {
            switch self {
            case .chain(let after): return ["after": String(after)]
            case .grants(let device): return ["device": device]
            default: return [:]
            }
        }

        var valid: Bool {
            switch self {
            case .enrollment(let id): return HubAccountPolicy.matches(id, "\\A[0-9a-f]{32}\\z")
            case .grants(let device): return Self.isEncoded(device, count: 16)
            case .object(let scope, let id):
                return Self.isEncoded(scope, count: 16) && Self.isEncoded(id, count: 32)
            default: return true
            }
        }

        private static func isEncoded(_ value: String, count: Int) -> Bool {
            guard let bytes = RemoteCoding.data(base64url: value) else { return false }
            return bytes.count == count && RemoteCoding.base64url(bytes) == value
        }
    }

    let account: String
    let origin: URL
    let generation: Int
    let session: HubAccountSession

    static func connected(_ session: HubAccountSession) async throws -> EnrollHub {
        try await withCheckedThrowingContinuation { continuation in
            session.queue.async(execute: DispatchWorkItem {
                guard let origin = session.origin, let credential = session.live() else {
                    return continuation.resume(throwing: HubAccountFailure.signedOut)
                }
                continuation.resume(returning: EnrollHub(
                    account: credential.subject, origin: origin, generation: session.generation, session: session))
            })
        }
    }

    func send(
        _ route: Route, as device: String, method: String = "GET", body: Data? = nil
    ) async throws -> HubAccountReply {
        guard route.valid, let bytes = RemoteCoding.data(base64url: device), bytes.count == 16,
            RemoteCoding.base64url(bytes) == device else { throw HubAccountFailure.refused }
        return try await withCheckedThrowingContinuation { continuation in
            session.queue.async(execute: DispatchWorkItem {
                let call = HubAccountCall(method: method, path: "/api/sync/v1/" + route.path,
                                          query: route.query, body: body)
                guard let credential = session.live(), credential.subject == account,
                    session.generation == generation,
                    var request = HubAccountPolicy.request(origin, call, token: credential.token)
                else { return continuation.resume(throwing: HubAccountFailure.superseded) }
                request.setValue(device, forHTTPHeaderField: "X-Harness-Device")
                if case .object = route {
                    request.setValue("text/plain; charset=utf-8", forHTTPHeaderField: "Content-Type")
                }
                session.transport.send(request) { result in
                    session.queue.async(execute: DispatchWorkItem {
                        guard generation == session.generation else {
                            return continuation.resume(throwing: HubAccountFailure.superseded)
                        }
                        if case .success(let reply) = result, reply.status == 401 { session.erase() }
                        continuation.resume(with: result)
                    })
                }
            })
        }
    }
}
