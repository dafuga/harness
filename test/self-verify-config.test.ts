import type { Manifest } from './self-verify-config.test.types';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { verifyConfigSchema } from '../src/core/verifyTypes';

/** Every file under a directory of this repository, as repository paths. */
function under(directory: string): string[] {
	return readdirSync(directory, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

/** True when a declared path, a file or a directory with a trailing slash, covers `path`. */
function covers(declared: string, path: string): boolean {
	const directory = declared.endsWith('/') ? declared : `${declared}/`;
	return path === declared || path.startsWith(directory);
}

test('this repository declares no source, test or specification file as something a check may write', () => {
	const config = verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8')));
	const manifests = under('specification/units').map(
		(file) => JSON.parse(readFileSync(file, 'utf8')) as Manifest
	);
	const source = manifests.flatMap((unit) => unit.owns.source);
	expect(source.length).toBeGreaterThan(500);
	// Loop state, scenarios, measurements and the registry itself are source too.
	const kept = [...source, ...under('specification'), ...under('test'), 'harness.verify.json'];
	expect(kept).toContain('specification/loops/agentic-self-hosting/loop.json');
	for (const declared of [...config.outputs, ...config.link]) {
		const covered = kept.filter((path) => covers(declared, path));
		expect([declared, covered]).toEqual([declared, []]);
	}
	// A build that is identified is compiled output, and it is declared as an output.
	for (const build of config.builds) {
		expect(config.outputs.some((declared) => covers(declared, `${build.directory}/x`))).toBe(true);
	}
});
