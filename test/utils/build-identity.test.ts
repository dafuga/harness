import { expect, test } from 'vitest';
import { buildIdentity } from '../../src/utils/buildIdentity';

const app = { path: 'assets/app.js', sha256: 'a'.repeat(64) };
const page = { path: 'index.html', sha256: 'b'.repeat(64) };

test('the identity covers every path and content hash, whatever order they are listed in', () => {
	const identity = buildIdentity([app, page]);
	expect(identity).toMatch(/^[0-9a-f]{64}$/);
	expect(buildIdentity([page, app])).toBe(identity);
	expect(buildIdentity([app])).not.toBe(identity);
	expect(buildIdentity([app, { ...page, sha256: 'c'.repeat(64) }])).not.toBe(identity);
	expect(buildIdentity([app, { ...page, path: 'home.html' }])).not.toBe(identity);
});

test('swapping the contents of two files changes the identity', () => {
	const swapped = [
		{ ...app, sha256: page.sha256 },
		{ ...page, sha256: app.sha256 }
	];
	expect(buildIdentity(swapped)).not.toBe(buildIdentity([app, page]));
});
