import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const native = resolve(import.meta.dirname, '../ios/App/App/Remote');
const checks = resolve(import.meta.dirname, '../ios/Checks/Native');
const program = `import Foundation
do {
    let b = Bench()
    b.online()
    let pending = b.ask("entity", ["projectId": "local-1"])
    b.event(b.link, "connection", 1, ["kind": "grant", "grant": ["projects": [], "agents": false]])
    b.answer(b.link, "entity", value: ["private": "old grant data"])
    check(pending.answer == nil && pending.failure != nil, "old-grant response cannot reach renderer")
    check(entries(b.root) == 0, "old-grant response cannot repopulate cache")
    try? FileManager.default.removeItem(at: b.root)
}
do {
    let b = Bench()
    b.online()
    _ = b.ask("snapshot")
    b.answer(b.link, "snapshot", value: ["private": "saved"])
    _ = b.ask("snapshot")
    let id = b.link.asked("snapshot").last?["id"] as? String ?? ""
    b.deliver(b.link, ["type": "response", "id": id, "ok": false,
                     "error": ["code": "project-denied", "message": "denied"]])
    check(entries(b.root) == 0, "authoritative denial purges saved reads")
    b.close(b.link, .lost)
    check(b.ask("snapshot").answer == nil, "denied project is unavailable offline")
    try? FileManager.default.removeItem(at: b.root)
}
print("Independent native authority checks: \\(passes) passed, \\(failures) failed")
exit(failures == 0 ? 0 : 1)
`;

test.runIf(process.platform === 'darwin')(
	'native late reads and denial cannot retain project access',
	() => {
		const folder = mkdtempSync(join(tmpdir(), 'harness-ios-authority-'));
		try {
			const main = join(folder, 'main.swift');
			const binary = join(folder, 'checks');
			writeFileSync(main, program);
			const sources = readdirSync(native)
				.filter((name) => name.endsWith('.swift') && name !== 'HarnessRemotePlugin.swift')
				.map((name) => join(native, name));
			const compile = spawnSync(
				'xcrun',
				[
					'swiftc',
					...sources,
					join(checks, 'Bench.swift'),
					join(checks, 'Support.swift'),
					main,
					'-o',
					binary
				],
				{ encoding: 'utf8' }
			);
			expect(compile.status, compile.stderr).toBe(0);
			const checked = spawnSync(binary, { encoding: 'utf8' });
			expect(checked.status, checked.stdout + checked.stderr).toBe(0);
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	},
	60_000
);
