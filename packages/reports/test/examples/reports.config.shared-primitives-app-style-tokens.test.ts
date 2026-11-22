import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { appStyleTokensConfig } from '../../src/configs/shared-primitives/appStyleTokensConfig';

test('Provides shared token catalog settings and role guidance', () => {
	expect(appStyleTokensConfig.roots).toEqual([
		'packages/reports/src',
		'packages/desktop/src',
		'packages/hub/src'
	]);
	expect(appStyleTokensConfig.groups).toContain('Colors');
	expect(appStyleTokensConfig.roles.Colors[0]).toMatchObject({
		name: 'Primary',
		base: '--hx-color-primary'
	});
	expect(appStyleTokensConfig.unassigned.name).toBe('Unassigned');
	recordExampleCases(
		{
			unitId: 'reports.config.shared-primitives-app-style-tokens',
			symbol: 'appStyleTokensConfig',
			state: 'provides-shared-token-catalog-settings-and-role-guidance',
			evidence: 'examples-cases',
			file: 'provides-shared-token-catalog-settings-and-role-guidance.json'
		},
		[
			{
				name: 'shared app token catalog resolves its sources, groups and primary role',
				input: null,
				output: {
					roots: appStyleTokensConfig.roots,
					tokenFile: appStyleTokensConfig.tokenFile,
					groups: appStyleTokensConfig.groups,
					foundation: appStyleTokensConfig.foundation,
					primaryRole: appStyleTokensConfig.roles.Colors[0],
					unassigned: appStyleTokensConfig.unassigned,
					designProperties: appStyleTokensConfig.designProperties.source,
					typographyProperties: appStyleTokensConfig.typographyProperties.source
				}
			}
		]
	);
});
