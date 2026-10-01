import type { PlannedFile } from '../core/files';
import { harnessRuleLimits } from '../rules/catalog';
import { cleanCodeDefaults } from '../audit/cleanCodeConfig';

export function auditConfigFiles(): PlannedFile[] {
	return [
		{
			path: 'harness.audit.json',
			contents: `${JSON.stringify({ limits: harnessRuleLimits, ignore: [], cleanCode: cleanCodeDefaults }, null, '\t')}\n`
		}
	];
}
