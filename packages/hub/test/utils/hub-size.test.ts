import { expect, test } from 'vitest';
import { hubSize } from '../../src/utils/hubSize';
import type { HubSourceContext } from '../../src/utils/hubSource';

test('missing source sizes stay explicitly unavailable rather than counting as zero', () => {
	const context = {
		entries: [{ path: 'src/example.ts', type: 'blob', mode: '100644', sha: 'a'.repeat(40) }]
	} as HubSourceContext;
	expect(hubSize(context, ['src/example.ts'])).toEqual({
		available: false,
		text: 'Not measured: source size unavailable'
	});
	expect(hubSize(context, ['src/missing.ts']).available).toBe(false);
});
