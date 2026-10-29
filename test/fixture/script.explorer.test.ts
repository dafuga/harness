import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { captureExample } from '../support/captureExample';
test('runExplorer: slugify without requested evidence', () => {
 const env = { ...process.env }; delete env.HARNESS_EVIDENCE_DIR;
 const result = spawnSync('node', ['scripts/explorer.mjs', 'slugify'], { env, encoding: 'utf8' });
 const actual = { status: result.status, stdout: result.stdout, stderr: result.stderr };
 const expected = { status: 0, stdout: '', stderr: '' };
 expect(actual).toEqual(expected);
 captureExample({ unit: 'script.explorer', id: 'slugify', state: 'evidence-disabled' }, actual, expected);
});
