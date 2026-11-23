#if DEBUG
import UIKit

extension VaultInboxController {
    func addLegacyFixtureControl() {
        let button = UIBarButtonItem(title: "Legacy test", style: .plain, target: self, action: #selector(legacyTest))
        navigationItem.rightBarButtonItems = (navigationItem.rightBarButtonItems ?? []) + [button]
    }

    @objc private func legacyTest() {
        perform {
            let fixture = try await VaultLegacyFixture.preview()
            let identity = fixture.review.identity
            let alert = UIAlertController(title: "Review synthetic legacy entry", message: "\(identity.domain)\n\(identity.username)", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            alert.addAction(UIAlertAction(title: "Save test entry", style: .default) { [weak self] _ in
                self?.confirmLegacy(fixture)
            })
            self.present(alert, animated: true)
        }
    }

    private func confirmLegacy(_ fixture: VaultLegacyFixture) {
        perform {
            let id = try await fixture.confirm()
            self.show("Test entry saved and reopened", message: id)
        }
    }
}
#endif
