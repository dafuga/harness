import { expect, test } from 'vitest';
import { parityReport } from '../../../src/core/execution-runtimes/scripted-deploy/parity';
import { deployFixture } from '../../support/scripted-deploy/fixture';

test('records missing environment coverage and blocks unexpected differences', () => {
	const fixture = deployFixture();
	try {
		const { staging, prod } = fixture.project.targets;
		const config = { ...fixture.project, targets: { staging, prod } };
		prod!.profile = { ...prod!.profile, secretNames: ['OTHER_TOKEN'] };
		expect(parityReport(config, {})).toMatchObject({
			coverage: { staging: 'declared', preprod: 'absent', prod: 'declared' },
			blocked: true,
			differences: [{ field: 'secretNames.OTHER_TOKEN' }, { field: 'secretNames.SERVICE_TOKEN' }]
		});
		config.differences = {
			'secretNames.OTHER_TOKEN': 'documented add',
			'secretNames.SERVICE_TOKEN': 'documented removal'
		};
		expect(parityReport(config, {})).toMatchObject({ blocked: false });
	} finally {
		fixture.dispose();
	}
});
