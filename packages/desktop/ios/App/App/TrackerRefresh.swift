import BackgroundTasks
import Network
import UIKit

/// Delivers system wakeups to the same bounded sync used by the foreground app.
enum TrackerRefresh {
    static let session = RemoteSession()
    private static let identifier = "com.dafuga.harness.tracker-refresh"
    private static let path = NWPathMonitor()

    static func register() {
        session.setTrackerForeground(false)
        path.start(queue: DispatchQueue(label: "com.dafuga.harness.tracker-path"))
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                return task.setTaskCompleted(success: false)
            }
            refresh.expirationHandler = { session.expireTrackerBackground() }
            DispatchQueue.main.async { run(refresh) }
        }
    }

    static func foreground() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
        session.setTrackerForeground(true)
    }

    static func background() {
        session.setTrackerForeground(false)
        schedule()
    }

    static func push(_ completion: @escaping (UIBackgroundFetchResult) -> Void) {
        guard available else { return completion(.noData) }
        session.start()
        session.beginTrackerBackground { result in
            DispatchQueue.main.async {
                switch result {
                case .updated: completion(.newData)
                case .unchanged: completion(.noData)
                case .failed: completion(.failed)
                }
            }
        }
    }

    private static func run(_ task: BGAppRefreshTask) {
        session.start()
        schedule()
        guard available else { return task.setTaskCompleted(success: true) }
        session.beginTrackerBackground { result in
            task.setTaskCompleted(success: result != .failed)
        }
    }

    private static var available: Bool {
        let network = path.currentPath
        return UIApplication.shared.backgroundRefreshStatus == .available
            && !ProcessInfo.processInfo.isLowPowerModeEnabled && network.status == .satisfied
            && !network.isExpensive && !network.isConstrained
    }

    private static func schedule() {
        guard UIApplication.shared.backgroundRefreshStatus == .available else { return }
        session.status { status in
            let methods = status["methods"] as? [String] ?? []
            guard methods.contains(RemoteSession.trackerMethod) else { return }
            let request = BGAppRefreshTaskRequest(identifier: identifier)
            request.earliestBeginDate = Date().addingTimeInterval(30 * 60)
            try? BGTaskScheduler.shared.submit(request)
        }
    }
}
