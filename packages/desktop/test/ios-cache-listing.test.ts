import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';

/**
 * The copies a phone keeps for when the computer is away, on the real Swift cache and session,
 * compiled for this Mac: no simulator, no relay, no Keychain. A catalog kept before route
 * loaders were left out is not answered; every other copy, the pairing and what a denial does
 * stay as they were.
 */
const native = resolve(import.meta.dirname, '../ios/App/App/Remote');
const checks = resolve(import.meta.dirname, '../ios/Checks/Native');
const program = `import CryptoKit
import Foundation

let tip: [String: Any] = ["projectId": "local-1", "branch": "main", "commit": NSNull()]
let pinned: [String: Any] = ["projectId": "local-1", "branch": "main", "commit": String(repeating: "b", count: 40)]
let detail: [String: Any] = ["projectId": "local-1", "entityId": "reports.page.analytics"]
let project: [String: Any] = ["id": "local-1", "name": "One"]
let listed: [String: Any] = ["project": project, "entities": [["id": "page.reports"]]]
let earlier: [String: Any] = ["project": project, "entities": [["id": "page.reports"], ["id": "reports.page.analytics"]]]
let bytes = Data([137, 80, 78, 71, 1, 2, 3])
let hash = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
let image: [String: Any] = ["projectId": "local-1", "sha256": hash]
let media: [String: Any] = [
    "encoding": "base64", "mediaType": "image/png", "byteLength": bytes.count, "sha256": hash,
    "data": bytes.base64EncodedString()
]

func kept(_ b: Bench, _ method: String, _ input: [String: Any], _ value: Any) {
    _ = b.ask(method, input)
    b.answer(b.link, method, value: value)
}

/// Makes the kept copy of the tip what the build before the catalog rule kept: the same file,
/// holding the catalog as it was listed then, with no word about a rule it was listed by.
func keptEarlier(_ root: URL) {
    let all = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)?.allObjects ?? []
    for case let file as URL in all where file.pathExtension == "json" {
        guard var entry = (try? Data(contentsOf: file)).flatMap(RemoteCoding.object),
            entry["method"] as? String == "snapshot", sameJSON(entry["input"], tip)
        else { continue }
        entry["value"] = earlier
        entry.removeValue(forKey: "projection")
        try? RemoteCoding.json(entry)?.write(to: file)
    }
}

do {
    let b = Bench()
    b.online()
    kept(b, "snapshot", tip, listed)
    kept(b, "snapshot", pinned, listed)
    kept(b, "entity", detail, ["id": "reports.page.analytics"])
    kept(b, "image", image, media)
    keptEarlier(b.root)
    b.close(b.link, .lost)
    let stale = b.ask("snapshot", tip)
    check(stale.answer == nil, "a catalog kept before route loaders were left out is not answered")
    check(stale.failure?.code == "offline", "the project is away until the computer is reached")
    check(entries(b.root) == 3, "only that copy is let go of")
    check(sameJSON(b.ask("snapshot", pinned).answer?.value, listed), "a catalog of an earlier commit kept by this build is answered")
    check(b.ask("entity", detail).answer != nil, "the detail of what a catalog leaves out is answered from its copy")
    check(sameJSON(b.ask("image", image).answer?.value, media), "kept media is answered as before")
    check(b.vault.record != nil && b.vault.wipes == 0 && b.state == "offline", "the pairing is kept")
    b.reconnect()
    b.attach()
    kept(b, "snapshot", tip, listed)
    b.close(b.link, .lost)
    check(sameJSON(b.ask("snapshot", tip).answer?.value, listed), "read again, the catalog of this build is kept and answered")
    try? FileManager.default.removeItem(at: b.root)
}
do {
    let b = Bench()
    b.online()
    kept(b, "snapshot", tip, listed)
    keptEarlier(b.root)
    _ = b.ask("snapshot", tip)
    let id = b.link.asked("snapshot").last?["id"] as? String ?? ""
    b.deliver(b.link, ["type": "response", "id": id, "ok": false,
                     "error": ["code": "project-denied", "message": "denied"]])
    check(entries(b.root) == 0, "a denial purges an earlier copy with every other one")
    b.close(b.link, .lost)
    check(b.ask("snapshot", tip).answer == nil, "nothing of a denied project is answered afterwards")
    try? FileManager.default.removeItem(at: b.root)
}
print("Catalog copy checks: \\(passes) passed, \\(failures) failed")
exit(failures == 0 ? 0 : 1)
`;

test.runIf(process.platform === 'darwin')(
	'a catalog the phone kept before route loaders were left out is not answered, and nothing else is lost',
	() => {
		const folder = mkdtempSync(join(tmpdir(), 'harness-ios-listing-'));
		try {
			const main = join(folder, 'main.swift');
			const binary = join(folder, 'checks');
			writeFileSync(main, program);
			const sources = readdirSync(native)
				.filter((name) => name.endsWith('.swift') && name !== 'HarnessRemotePlugin.swift')
				.map((name) => join(native, name));
			const support = ['Bench.swift', 'Support.swift'].map((name) => join(checks, name));
			const compile = spawnSync('xcrun', ['swiftc', ...sources, ...support, main, '-o', binary], {
				encoding: 'utf8'
			});
			expect(compile.status, compile.stderr).toBe(0);
			const checked = spawnSync(binary, { encoding: 'utf8' });
			const failed = checked.stdout.split('\n').filter((line) => line.startsWith('FAIL '));
			expect(failed).toEqual([]);
			expect(checked.stdout).toContain('10 passed, 0 failed');
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	},
	120_000
);
