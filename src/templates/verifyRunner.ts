import type { PlannedFile } from '../core/files';
import type { ProjectKind } from './project';

export function verifyRunnerFiles(kind: ProjectKind): PlannedFile[] {
	return [{ path: 'scripts/frame-verify.ts', contents: verifyRunnerContents(kind) }];
}

function verifyRunnerContents(kind: ProjectKind): string {
	return `const frameCliPath = process.env.FRAME_CLI_PATH;\nconst args = frameCliPath\n\t? ['bun', frameCliPath, 'verify', '.', '--profile', '${kind}']\n\t: ['frame', 'verify', '.', '--profile', '${kind}'];\n\nconst result = Bun.spawnSync(args, {\n\tstdout: 'inherit',\n\tstderr: 'inherit'\n});\n\nprocess.exit(result.exitCode);\n`;
}
