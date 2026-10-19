import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { hubImageOption, hubRevision } from '../../src/utils/hub-catalog/hubOptions';
import { hubOptions } from '../../src/utils/hub-designs/hubOptions';
import type { HubDesign } from '../../src/utils/hubSchemas';

/**
 * Stored design options must divide the images of their version exactly, as planning writes
 * them; a single design passes as it always did. SYNTHETIC records, no Git or network.
 */
type Binding = { file: string; sha256: string };
const [a, b, c] = ['a', 'b', 'c'].map((letter) => ({
	file: `o-${letter}-default-desktop.png`,
	sha256: letter.repeat(64)
}));
const image = (binding: Binding) => ({
	...{ ...binding, state: 'default', viewport: 'desktop' as const },
	...{ bytes: 1, width: 1, height: 1 }
});
const option = (id: string, ...images: Binding[]) => ({
	...{ id, direction: `Synthetic ${id}`, prompt: null, revisedPrompt: null },
	...{ generator: { provider: 'codex', model: 'synthetic' }, images }
});
const design = (options?: ReturnType<typeof option>[]) =>
	({ images: [a, b].map(image), options, revises: null }) as unknown as HubDesign;

test('options that divide the images exactly pass, and a single design passes as it was', () => {
	const exact = design([option('o1', a), option('o2', b)]);
	expect(hubOptions(exact)).toBe(exact);
	const single = design();
	expect(hubOptions(single)).toBe(single);
});

test.each([
	['share one image', [option('o1', a), option('o2', b, a)]],
	['leave an image unclaimed', [option('o1', a)]],
	['bind another hash', [option('o1', a), option('o2', { ...b, sha256: 'f'.repeat(64) })]],
	['start at another id', [option('o2', a), option('o3', b)]],
	['claim a file the version does not hold', [option('o1', a), option('o2', b), option('o3', c)]]
])('options that %s are refused as a corrupt artifact', (_name, options) => {
	expect(() => hubOptions(design(options))).toThrow(
		expect.objectContaining({ code: 'artifact-corrupt' })
	);
});

test('an image names the option holding it, and a single design names none', () => {
	const value = design([option('o1', a), option('o2', b)]);
	expect(hubImageOption(value, b.file)).toEqual({ option: 'o2' });
	expect(hubImageOption(design(), a.file)).toEqual({});
});

test('a revision keeps the fields the desktop reads, and nothing is said when there is none', () => {
	const revises = {
		...{ version: 'v001', file: a.file, imageSha256: a.sha256 },
		...{ region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, threadId: null, option: 'o1' }
	};
	expect(hubRevision({ ...design(), revises } as HubDesign)).toEqual({
		revises: {
			version: 'v001',
			imageSha256: a.sha256,
			region: revises.region,
			threadId: null,
			option: 'o1'
		}
	});
	expect(hubRevision(design())).toEqual({});
	const legacy = { ...revises, option: undefined };
	expect(hubRevision({ ...design(), revises: legacy } as HubDesign).revises).not.toHaveProperty(
		'option'
	);
});
