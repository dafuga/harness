import type { PlannedFile } from '../../core/development-tooling/files';
import { harnessRuleLimits } from '../../rules/explorer-ui/catalog';
import { cleanCodeDefaults } from '../../audit/development-tooling/cleanCodeConfig';

export function auditConfigFiles(): PlannedFile[] {
	return [
		{
			path: 'harness.audit.json',
			contents: `${JSON.stringify({ limits: harnessRuleLimits, ignore: [], cleanCode: cleanCodeDefaults }, null, '\t')}\n`
		}
	];
}
