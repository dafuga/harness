import type { PlannedFile } from '../core/files';
import type { ProjectKind } from './project';

export function verifyRunnerFiles(kind: ProjectKind): PlannedFile[] {
	return [{ path: 'scripts/harness-verify.ts', contents: verifyRunnerContents(kind) }];
}

function verifyRunnerContents(kind: ProjectKind): string {
	return `const harnessCliPath = process.env.HARNESS_CLI_PATH;\nconst args = harnessCliPath\n\t? ['bun', harnessCliPath, 'verify', '.', '--profile', '${kind}']\n\t: ['harness', 'verify', '.', '--profile', '${kind}'];\n\nconst result = Bun.spawnSync(args, {\n\tstdout: 'inherit',\n\tstderr: 'inherit'\n});\n\nprocess.exit(result.exitCode);\n`;
}
