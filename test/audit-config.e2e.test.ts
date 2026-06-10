import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

test('generated projects share configured limits between lint and audit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-config-e2e-'));
	try {
		await runHarness(['new', 'lib', 'configured-lib'], root);
		const project = join(root, 'configured-lib');

		await writeConfig(project);
		await mkdir(join(project, 'src/utils'), { recursive: true });
		await writeFile(join(project, 'src/utils/longFile.ts'), longFileFixture());
		await runCommand(['bun', 'install'], project);

		const lint = await runCommand(['bun', 'run', 'lint'], project);
		const audit = await runHarness(['audit', '.'], project);

		expect(lint.exitCode).toBe(0);
		expect(audit.stdout).toContain('Harness audit passed');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function writeConfig(project: string): Promise<void> {
	const config = JSON.parse(await readFile(join(project, 'harness.audit.json'), 'utf8')) as {
		limits: Record<string, number>;
		ignore: unknown[];
	};
	config.limits.maxFileLines = 300;
	await writeFile(join(project, 'harness.audit.json'), JSON.stringify(config, null, '\t'));
}

function longFileFixture(): string {
	return `${['export function longFile(): number {', '\treturn 1;', '}']
		.concat(Array.from({ length: 222 }, (_, index) => `export const value${index} = ${index};`))
		.join('\n')}\n`;
}
