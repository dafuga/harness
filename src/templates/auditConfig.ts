import type { PlannedFile } from '../core/files';
import { harnessRuleLimits } from '../rules/catalog';

export function auditConfigFiles(): PlannedFile[] {
	return [
		{
			path: 'harness.audit.json',
			contents: `${JSON.stringify({ limits: harnessRuleLimits, ignore: [] }, null, '\t')}\n`
		}
	];
}
