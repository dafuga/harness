import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { auditRunnerFiles } from '../../src/templates/development-tooling/auditRunner';

function auditScript(kind: string): string {
	return `const harnessCliPath = process.env.HARNESS_CLI_PATH;\nconst args = harnessCliPath\n\t? ['bun', harnessCliPath, 'audit', '.', '--profile', '${kind}']\n\t: ['harness', 'audit', '.', '--profile', '${kind}'];\n\nconst result = Bun.spawnSync(args, {\n\tstdout: 'inherit',\n\tstderr: 'inherit'\n});\n\nprocess.exit(result.exitCode);\n`;
}

test('Plans the audit script for an app project', () => {
	const files = auditRunnerFiles('app');

	expect(files).toEqual([{ path: 'scripts/harness-audit.ts', contents: auditScript('app') }]);
	expect(files[0]?.contents).toContain("'--profile', 'app'");
	recordExampleCases(
		{
			unitId: 'template.audit-runner',
			symbol: 'auditRunnerFiles',
			state: 'plans-the-audit-script-for-an-app-project',
			evidence: 'examples-cases',
			file: 'plans-the-audit-script-for-an-app-project.json'
		},
		[
			{
				name: 'app project plans scripts/harness-audit.ts with profile app',
				input: { kind: 'app' },
				output: files
			}
		]
	);
});

test('Plans the audit script for a lib project', () => {
	const files = auditRunnerFiles('lib');

	expect(files).toEqual([{ path: 'scripts/harness-audit.ts', contents: auditScript('lib') }]);
	expect(files[0]?.contents).toContain("'--profile', 'lib'");
	recordExampleCases(
		{
			unitId: 'template.audit-runner',
			symbol: 'auditRunnerFiles',
			state: 'plans-the-audit-script-for-a-lib-project',
			evidence: 'examples-cases',
			file: 'plans-the-audit-script-for-a-lib-project.json'
		},
		[
			{
				name: 'lib project plans scripts/harness-audit.ts with profile lib',
				input: { kind: 'lib' },
				output: files
			}
		]
	);
});
