import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const owner = JSON.parse(
	readFileSync(resolve(root, 'specification/units/hub.function.browser-bridge.json'), 'utf8')
).runtime.entry;

for (const [entry, path] of [
	['public', 'packages/hub/src/utils/browserBridge.ts'],
	['owner', owner]
]) {
	test(`hosted project bridge supports a cold ${entry} entry without generated app state`, () => {
		const directory = mkdtempSync(resolve(tmpdir(), 'harness-bridge-cold-'));
		try {
			const config = resolve(directory, 'tsconfig.json');
			writeFileSync(
				config,
				JSON.stringify({
					compilerOptions: {
						baseUrl: root,
						paths: { '$desktop/*': [resolve(root, 'packages/desktop/src/*')] }
					}
				})
			);
			const script = `import { browserBridge } from ${JSON.stringify(resolve(root, path))};
				const bridge = browserBridge({ get: async () => [{ id: 'p', name: 'Project' }] });
				console.log(JSON.stringify(await bridge.listProjects()));`;
			const output = execFileSync('bun', ['--tsconfig-override', config, '-e', script], {
				cwd: root,
				encoding: 'utf8',
				timeout: 10000
			});
			expect(JSON.parse(output.trim())).toEqual([{ id: 'p', name: 'Project', kind: 'shared' }]);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
