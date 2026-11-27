import Foundation

public struct BrokerClient: Sendable {
    public typealias Sign = @MainActor (Data) throws -> Data

    let origin: String
    let deviceID: String
    let transport: URLSession

    public init(origin: String, deviceID: String) throws {
        try self.init(origin: origin, deviceID: deviceID, transport: Self.session)
    }

    init(origin: String, deviceID: String, transport: URLSession) throws {
        _ = try BrokerProtocol.origin(origin)
        guard BrokerProtocol.validDeviceID(deviceID) else { throw BrokerError.invalidDevice }
        self.origin = origin
        self.deviceID = deviceID
        self.transport = transport
    }

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.timeoutIntervalForResource = 12
        return URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }()
}

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}
