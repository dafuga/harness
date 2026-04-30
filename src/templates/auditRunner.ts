import type { PlannedFile } from '../core/files';
import type { ProjectKind } from './project';

export function auditRunnerFiles(kind: ProjectKind): PlannedFile[] {
	return [{ path: 'scripts/frame-audit.ts', contents: auditRunnerContents(kind) }];
}

function auditRunnerContents(kind: ProjectKind): string {
	return `const frameCliPath = process.env.FRAME_CLI_PATH;\nconst args = frameCliPath\n\t? ['bun', frameCliPath, 'audit', '.', '--profile', '${kind}']\n\t: ['frame', 'audit', '.', '--profile', '${kind}'];\n\nconst result = Bun.spawnSync(args, {\n\tstdout: 'inherit',\n\tstderr: 'inherit'\n});\n\nprocess.exit(result.exitCode);\n`;
}
