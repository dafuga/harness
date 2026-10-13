import { expect, test } from 'vitest';
import { rendererPolicy } from '../src/utils/rendererAssets';

/**
 * What the compiled renderer may load. A recorded clip is shown from an object URL of bytes the
 * page hashed again, so media may come from the app and from a blob, as images already may.
 * Nothing else is opened by that: scripts, frames, objects, the base address and connections
 * stay as closed as they were.
 */
const page = '<html><script>window.a = 1</script><script src="/x.js"></script></html>';
/** The policy as directives: each name with the sources it allows. */
const directives = (policy: string) =>
	new Map(
		policy.split(';').map((part) => {
			const [name, ...sources] = part.trim().split(/\s+/);
			return [name, sources] as const;
		})
	);

test('a recorded clip may play from the app or from a blob, and from nowhere else', () => {
	const media = directives(rendererPolicy(page)).get('media-src');
	expect(media).toEqual(["'self'", 'blob:']);
});

test('scripts, frames, objects and the base address are as closed as before', () => {
	const policy = directives(rendererPolicy(page));
	const scripts = policy.get('script-src') ?? [];
	expect(scripts[0]).toBe("'self'");
	// Beside the app itself only the inline scripts of this very page, each by its hash.
	expect(scripts.slice(1).every((source) => /^'sha256-[A-Za-z0-9+/=]+'$/.test(source))).toBe(true);
	expect(scripts.slice(1)).toHaveLength(2);
	expect(policy.get('default-src')).toEqual(["'self'"]);
	expect(policy.get('frame-src')).toEqual(["'none'"]);
	expect(policy.get('object-src')).toEqual(["'none'"]);
	expect(policy.get('base-uri')).toEqual(["'none'"]);
});

test('a blob is allowed for pictures and clips only, and nothing is allowed everywhere', () => {
	const policy = directives(rendererPolicy(page, 'ws://127.0.0.1:8791'));
	const blobs = [...policy]
		.filter(([, sources]) => sources.includes('blob:'))
		.map(([name]) => name);
	expect(blobs.sort()).toEqual(['img-src', 'media-src']);
	const all = [...policy.values()].flat();
	for (const open of ['*', "'unsafe-eval'", 'data:', 'http:', 'https:'])
		expect(all.filter((source) => source === open)).toEqual(open === 'data:' ? ['data:'] : []);
	expect(policy.get('img-src')).toEqual(["'self'", 'blob:', 'data:']);
});

test('a page connects to the app and to the one socket it was given', () => {
	expect(directives(rendererPolicy(page)).get('connect-src')).toEqual(["'self'"]);
	const given = directives(rendererPolicy(page, 'ws://127.0.0.1:8791')).get('connect-src');
	expect(given).toEqual(["'self'", 'ws://127.0.0.1:8791']);
});
