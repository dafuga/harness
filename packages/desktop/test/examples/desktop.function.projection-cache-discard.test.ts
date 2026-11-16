import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { projectionCacheDiscard } from '../../src/lib/development-tooling/desktop-initialization/projection-cache-service/projectionCacheDiscard';

function digest(value: string) {
	return createHash('sha256').update(value).digest('hex');
}

function cacheFiles(directory: string, scope: string, identity: Record<string, string>) {
	const lookup = `lookup-${digest(scope)}.json`;
	const projection = `projection-${digest(JSON.stringify(Object.entries(identity).sort(([a], [b]) => a.localeCompare(b))))}.json`;
	writeFileSync(join(directory, lookup), JSON.stringify({ identity }));
	writeFileSync(join(directory, projection), 'cached projection');
	return { lookup, projection };
}

test('discards the scoped lookup and its identified projection', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'projection-cache-discard-'));
	try {
		const scope = '["https://hub.example.com","google:ada","$projects","projects"]';
		const identity = { origin: 'https://hub.example.com', principal: 'google:ada', project: '$projects', key: 'projects' };
		const files = cacheFiles(directory, scope, identity);
		await projectionCacheDiscard(directory, scope);
		const remaining = [files.lookup, files.projection].filter((file) => existsSync(join(directory, file)));
		expect(remaining).toEqual([]);
		recordExampleCases(
			{
				unitId: 'desktop.function.projection-cache-discard',
				symbol: 'projectionCacheDiscard',
				state: 'discards-the-scoped-lookup-and-its-identified-projection',
				evidence: 'examples-cases',
				file: 'discards-the-scoped-lookup-and-its-identified-projection.json'
			},
			[{ name: 'remove lookup and projection for a hosted projects scope', input: { directory: '<temporary-cache>', scope, identity }, output: { lookupRemoved: true, projectionRemoved: true } }]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('resolves when the scoped lookup is missing', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'projection-cache-missing-'));
	try {
		const scope = '["https://hub.example.com","google:ada","550e8400-e29b-41d4-a716-446655440000","/api/projects/550e8400-e29b-41d4-a716-446655440000/snapshot"]';
		await expect(projectionCacheDiscard(directory, scope)).resolves.toBeUndefined();
		recordExampleCases(
			{
				unitId: 'desktop.function.projection-cache-discard',
				symbol: 'projectionCacheDiscard',
				state: 'resolves-when-the-scoped-lookup-is-missing',
				evidence: 'examples-cases',
				file: 'resolves-when-the-scoped-lookup-is-missing.json'
			},
			[{ name: 'missing lookup for a project snapshot scope', input: { directory: '<temporary-cache>', scope }, output: 'resolved undefined' }]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
