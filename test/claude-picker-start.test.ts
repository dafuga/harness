import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const startScript = resolve('plugins/claude-picker/scripts/start.sh');
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Copies start.sh into a throwaway plugin root so the ignored dist never affects the test. */
function pluginRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'harness-picker-start-'));
	roots.push(root);
	mkdirSync(join(root, 'scripts'));
	copyFileSync(startScript, join(root, 'scripts/start.sh'));
	return root;
}

function runStart(root: string) {
	return spawnSync('bash', [join(root, 'scripts/start.sh')], {
		encoding: 'utf8',
		env: { PATH: process.env.PATH ?? '', HOME: root, HARNESS_PICKER_BUN: process.execPath }
	});
}

test('start.sh names the exact build command when dist is missing', () => {
	const result = runStart(pluginRoot());
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('Claude picker build missing');
	expect(result.stderr.split('\n')).toContain('  bun run build:picker');
	expect(result.stdout).toBe('');
});

test('start.sh reports the missing build when only one dist file exists', () => {
	const root = pluginRoot();
	mkdirSync(join(root, 'dist'));
	writeFileSync(join(root, 'dist/server.js'), '');
	const result = runStart(root);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('bun run build:picker');
});
