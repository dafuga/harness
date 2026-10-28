import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
function disabled(mode: string) {
 const env = { ...process.env };
 for (const key of Object.keys(env)) if (key.startsWith('FIXTURE_') || key === 'HARNESS_EVIDENCE_DIR') delete env[key];
 const result = spawnSync('node', ['scripts/fixture.mjs', mode, 'test/fixture/function.slugify.test.ts'], { env, encoding: 'utf8' });
 expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({ status: 0, stdout: '', stderr: '' });
}
test('runFixture: test without requested evidence', () => disabled('test'));
test('runFixture: audio without requested evidence', () => disabled('audio'));
test('runFixture: clock without requested evidence', () => disabled('clock'));
test('runFixture: bench without requested evidence', () => disabled('bench'));
test('runFixture: control without requested evidence', () => disabled('control'));
