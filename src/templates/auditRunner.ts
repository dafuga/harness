import type { PlannedFile } from '../core/files';
import type { ProjectKind } from './project';

export function auditRunnerFiles(kind: ProjectKind): PlannedFile[] {
	return [{ path: 'scripts/harness-audit.ts', contents: auditRunnerContents(kind) }];
}

function auditRunnerContents(kind: ProjectKind): string {
	return `const harnessCliPath = process.env.HARNESS_CLI_PATH;\nconst args = harnessCliPath\n\t? ['bun', harnessCliPath, 'audit', '.', '--profile', '${kind}']\n\t: ['harness', 'audit', '.', '--profile', '${kind}'];\n\nconst result = Bun.spawnSync(args, {\n\tstdout: 'inherit',\n\tstderr: 'inherit'\n});\n\nprocess.exit(result.exitCode);\n`;
}
