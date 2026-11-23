import UIKit

/// Review and approval stay in UIKit. The web view can only open or close this screen.
final class VaultInboxController: UITableViewController {
    private let session: RemoteSession
    private var inbox: VaultInbox?
    private var requests: [VaultApprovalRequest] = []
    private var busy = false

    init(session: RemoteSession) {
        self.session = session
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Vault"
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reload))
        #if DEBUG
        addLegacyFixtureControl()
        #endif
        perform { self.inbox = try await VaultInbox(session: self.session) }
    }

    @objc private func close() { dismiss(animated: true) }

    @objc private func reload() {
        perform {
            if self.inbox == nil { self.inbox = try await VaultInbox(session: self.session) }
            guard let inbox = self.inbox else { return }
            self.requests = try await inbox.requests()
        }
    }

    func perform(_ action: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        busy = true
        tableView.allowsSelection = false
        navigationItem.rightBarButtonItem?.isEnabled = false
        Task { @MainActor in
            defer {
                busy = false
                tableView.allowsSelection = true
                navigationItem.rightBarButtonItem?.isEnabled = true
                tableView.reloadData()
            }
            do { try await action() } catch {
                show("Vault request unavailable", message: "Check the connection, device enrollment, and request expiry, then refresh.")
            }
        }
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        requests.count + 2
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
        if indexPath.row == 0 {
            cell.textLabel?.text = "Show public enrollment key"
        } else if indexPath.row == 1 {
            cell.textLabel?.text = "Open synthetic requests"
        } else {
            let request = requests[indexPath.row - 2]
            cell.textLabel?.text = request.site + " · " + request.action
            cell.detailTextLabel?.text = request.account + " · " + request.method.rawValue
            cell.accessoryType = .disclosureIndicator
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        switch indexPath.row {
        case 0: enroll()
        case 1: reload()
        default: review(requests[indexPath.row - 2])
        }
    }

    private func enroll() {
        guard let inbox = inbox else { return reload() }
        perform {
            let pin = try await inbox.enroll()
            let alert = UIAlertController(title: "Public enrollment key", message: inbox.deviceId + "\n\n" + pin, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Copy public key", style: .default) { _ in UIPasteboard.general.string = pin })
            alert.addAction(UIAlertAction(title: "Done", style: .cancel))
            self.present(alert, animated: true)
        }
    }

    private func review(_ request: VaultApprovalRequest) {
        let alert = UIAlertController(title: "Review synthetic request", message: request.reviewText, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Deny", style: .destructive) { [weak self] _ in self?.decide(request, false) })
        alert.addAction(UIAlertAction(title: "Approve test request", style: .default) { [weak self] _ in self?.decide(request, true) })
        present(alert, animated: true)
    }

    private func decide(_ request: VaultApprovalRequest, _ approve: Bool) {
        guard let inbox = inbox else { return }
        perform {
            try await inbox.decide(request, approve: approve)
            self.requests.removeAll { $0.requestId == request.requestId }
            self.show(approve ? "Request approved" : "Request denied", message: nil)
        }
    }

    func show(_ title: String, message: String?) {
        guard viewIfLoaded?.window != nil, presentedViewController == nil else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Done", style: .default))
        present(alert, animated: true)
    }
}

private extension VaultApprovalRequest {
    var reviewText: String {
        let expires = Date(timeIntervalSince1970: Double(expiresAt) / 1000)
        let expiry = DateFormatter.localizedString(from: expires, dateStyle: .short, timeStyle: .medium)
        let digest = recipe.digest.prefix(16)
        let groups = stride(from: 0, to: digest.count, by: 4).map { String(digest.dropFirst($0).prefix(4)) }
        return [site + " · " + action, account + " · " + method.rawValue + " · " + mode.rawValue,
                "Project \(project) / \(environment) · Tracker \(item)", "Session \(session)", "Host \(host)",
                origins.joined(separator: "\n"), "Recipe \(recipe.revision) · " + groups.joined(separator: " "),
                "Runner \(runnerFingerprint)", "Lease \(leaseMs / 1000) seconds · Expires \(expiry)", reason]
            .joined(separator: "\n\n")
    }
}
