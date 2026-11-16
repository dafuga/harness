import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubSize } from '../../src/routes/api/[...path]/hub-projection-service/hubSize';

const context = (entries: Array<{ path: string; size?: number }>) =>
	({ entries }) as Parameters<typeof hubSize>[0];

test('Summarizes requested source sizes and unavailable paths', () => {
	const sourcePath = 'packages/hub/src/routes/api/[...path]/hub-projection-service/hubSize.ts';
	const measured = hubSize(context([{ path: sourcePath, size: 2560 }]), [sourcePath]);
	const repeated = hubSize(context([{ path: 'packages/hub/src/utils/hubSize.ts', size: 1024 }]), [
		'packages/hub/src/utils/hubSize.ts',
		'packages/hub/src/utils/hubSize.ts'
	]);
	const unavailable = hubSize(context([{ path: 'packages/hub/src/utils/hubSize.ts' }]), [
		'packages/hub/src/utils/hubSize.ts',
		'packages/hub/src/services/hub-projection-service/hubSize.ts'
	]);
	const designOnly = hubSize(context([]), []);

	expect([measured, repeated, unavailable, designOnly]).toEqual([
		{ available: true, text: '2.5 KB' },
		{ available: true, text: '2.0 KB' },
		{ available: false, text: 'Not measured: source size unavailable' },
		{ available: false, text: 'Not measured: design only' }
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-size',
			symbol: 'hubSize',
			state: 'summarizes-requested-source-sizes-and-unavailable-paths',
			evidence: 'examples-cases',
			file: 'summarizes-requested-source-sizes-and-unavailable-paths.json'
		},
		[
			{ name: 'one measured source path', input: [sourcePath], output: measured },
			{
				name: 'repeated paths count their measured size repeatedly',
				input: ['packages/hub/src/utils/hubSize.ts', 'packages/hub/src/utils/hubSize.ts'],
				output: repeated
			},
			{
				name: 'missing or unmeasured requested paths',
				input: [
					'packages/hub/src/utils/hubSize.ts',
					'packages/hub/src/services/hub-projection-service/hubSize.ts'
				],
				output: unavailable
			},
			{ name: 'no source paths', input: [], output: designOnly }
		]
	);
});
