import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { hubMetadataPaths } from '../../src/utils/hub-metadata/hubMetadataPaths';

test('batch metadata excludes source, images and symlink targets', () =>
	measureWorkload('hub.function.hub-metadata-paths', 'layout-catalog-behavior', () => {
		const entries = [
			'specification/units/page.example.json',
			'src/pages/example/plan.json',
			'src/layouts/example/plan.json',
			'src/pages/example/designs/v001/design.json',
			'src/pages/example/designs/v001/default-desktop.png',
			'src/services/private.ts'
		].map((path) => ({ path, type: 'blob' as const, mode: '100644', sha: 'a'.repeat(40) }));
		expect(hubMetadataPaths(entries)).toEqual(entries.slice(0, 4).map((entry) => entry.path));
		expect(hubMetadataPaths([{ ...entries[0], mode: '120000' }])).toEqual([]);
	}));
