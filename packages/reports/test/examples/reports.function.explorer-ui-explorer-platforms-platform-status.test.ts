import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { platformViews, unrecorded, platformStatus } from '../../src/utils/explorer-ui/explorer-platforms/platformStatus';
import type { PlatformView } from '../../src/utils/explorer-ui/explorer-platforms/platformStatus.types';
import type { PlatformEntry } from '../../../../src/core/explorer-ui/Platform.types';

test('Maps platform statuses and views', () => {
	const viewExample = [
		{ id: 'web', name: 'Web', icon: 'web' },
		{ id: 'ios', name: 'iOS', icon: 'phone' },
		{ id: 'android', name: 'Android', icon: 'android' },
		{ id: 'desktop', name: 'Desktop (Electron)', icon: 'desktop' }
	] satisfies PlatformView[];
	const platform = {
		id: 'web',
		runtime: 'Browser',
		status: 'not-configured',
		summary: 'Web platform configuration is not present.',
		configuration: [],
		commands: [],
		requirements: [],
		sources: []
	} satisfies PlatformEntry;
	const configured = platformStatus({ ...platform, status: 'configured' });
	const setupRequired = platformStatus({ ...platform, status: 'setup-required' });
	const notConfigured = platformStatus(platform);
	const notRecorded = platformStatus();

	expect(platformViews).toEqual(viewExample);
	expect(unrecorded).toBe('No platform configuration is recorded at this revision.');
	expect([configured, setupRequired, notConfigured, notRecorded]).toEqual([
		{ id: 'configured', label: 'Configured' },
		{ id: 'setup-required', label: 'Setup required' },
		{ id: 'not-configured', label: 'Not configured' },
		{ id: 'not-recorded', label: 'Not recorded' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-explorer-platforms-platform-status',
			symbol: 'platformStatus',
			state: 'maps-platform-statuses-and-views',
			evidence: 'examples-cases',
			file: 'maps-platform-statuses-and-views.json'
		},
		[
			{ name: 'web platform has no configuration', input: platform, output: notConfigured },
			{
				name: 'platform declaration is configured',
				input: { ...platform, status: 'configured' },
				output: configured
			},
			{
				name: 'platform setup is required',
				input: { ...platform, status: 'setup-required' },
				output: setupRequired
			},
			{ name: 'platform declaration is omitted', input: null, output: notRecorded }
		]
	);
});
