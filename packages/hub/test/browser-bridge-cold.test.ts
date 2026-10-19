import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const cases: Array<{
	unit: string;
	publicEntry: string;
	symbol: string;
	call: string;
	expected: unknown;
}> = [
	{
		unit: 'hub.function.browser-bridge',
		publicEntry: 'packages/hub/src/utils/browserBridge.ts',
		symbol: 'browserBridge',
		call: `const bridge = browserBridge({ get: async () => [{ id: 'p', name: 'Project' }] });
			console.log(JSON.stringify(await bridge.listProjects()));`,
		expected: [{ id: 'p', name: 'Project', kind: 'shared' }]
	},
	{
		unit: 'desktop.function.comment-entries',
		publicEntry: 'packages/desktop/src/utils/commentEntries.ts',
		symbol: 'commentEntries',
		call: `const entries = commentEntries({ anchor: { version: 'v1', imageSha256: 'hash' },
			comments: [{ id: 'c', createdAt: 'now', actor: { name: 'Ada' }, text: 'Hello' }] });
			console.log(JSON.stringify(entries.map(v => [v.id, v.author, v.authorName, v.text, v.version])));`,
		expected: [['c', 'user', 'Ada', 'Hello', 'v1']]
	},
	{
		unit: 'desktop.function.hosted-artifact',
		publicEntry: 'packages/desktop/src/utils/hostedArtifact.ts',
		symbol: 'hostedArtifact',
		call: `import { createHash } from 'node:crypto';
			const bytes = new TextEncoder().encode('example');
			const digest = createHash('sha256').update(bytes).digest('hex');
			const answer = await hostedArtifact({ bytes, mediaType: 'text/plain' }, digest);
			console.log(JSON.stringify([new TextDecoder().decode(answer.bytes), answer.sha256 === digest]));`,
		expected: ['example', true]
	}
];
for (const example of cases) {
	const owner = JSON.parse(
		readFileSync(resolve(root, `specification/units/${example.unit}.json`), 'utf8')
	).runtime.entry;
	for (const [entry, path] of [
		['public', example.publicEntry],
		['owner', owner]
	]) {
		test(`${example.symbol} supports a cold ${entry} entry without generated app state`, () => {
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
				const script = `import { ${example.symbol} } from ${JSON.stringify(resolve(root, path))};
				${example.call}`;
				const output = execFileSync('bun', ['--tsconfig-override', config, '-e', script], {
					cwd: root,
					encoding: 'utf8',
					timeout: 10000
				});
				expect(JSON.parse(output.trim())).toEqual(example.expected);
			} finally {
				rmSync(directory, { recursive: true, force: true });
			}
		});
	}
}
