import { test } from 'vitest';
import type { PlatformId } from '../../src/core/explorer-ui/Platform.types';
import { platformIds } from '../../src/core/explorer-ui/PlatformValues';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const expectedIds = ['web', 'ios', 'android', 'desktop'];

test('Platform ids are the four supported targets', () => {
	const desktop: PlatformId = 'desktop';
	const accepted = platformIds.includes(desktop);

	expect([...platformIds]).toEqual(expectedIds);
	expect(accepted).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-platform-types',
			symbol: 'platformIds',
			state: 'platform-ids-are-the-four-supported-targets',
			evidence: 'examples-cases',
			file: 'platform-ids-are-the-four-supported-targets.json'
		},
		[
			{
				name: 'lists the four supported platform identifiers',
				input: { export: 'platformIds' },
				output: expectedIds
			},
			{
				name: 'accepts desktop as a PlatformId',
				input: { id: desktop },
				output: { id: desktop, accepted }
			}
		]
	);
});
