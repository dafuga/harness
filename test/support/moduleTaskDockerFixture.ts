import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect } from '../verificationExpect';
import { moduleTaskFixture } from './moduleTaskFixture';
import { runCommand, runHarness } from './cli';
import { createTempDirectory } from './temporary';

const fixtureSource = `#!/usr/bin/env bun
import {writeFileSync} from 'node:fs';
const prompt = await Bun.stdin.text();
const model = process.argv[process.argv.indexOf('--model')+1];
if (process.platform !== 'linux' || process.cwd() !== '/workspace') process.exit(17);
if (prompt.includes('Synthetic failure.')) process.exit(37);
if (!prompt.includes('Checkpoint file: .cache/harness/') || !model) process.exit(18);
if (process.env.ANTHROPIC_API_KEY || process.env.HARNESS_RESOURCE_LEASE) process.exit(19);
writeFileSync('src/orders.ts', 'export const orders = 2;\\n');
console.error('Diagnostic stderr must not pollute the structured result.');
console.log(JSON.stringify({type:'system',subtype:'init',model}));
console.log(JSON.stringify({type:'result',result:'Offline Linux fixture finished ✓'}));
`;

export async function verifyDockerWorker(base: string) {
	await withDockerFixture(base, async (f, env) => {
		await f.feature();
		const added = await f.cli(
			['add', '--input', await f.input({ model: 'claude-haiku-5-5', platform: 'linux' })],
			false
		);
		expect(added.exitCode, added.stderr).toBe(0);
		expect(JSON.parse(added.stdout).task.platform).toBe('linux');
		const result = await runHarness(
			['task', 'worker', '--worker', 'owner', '--once', '--json'],
			f.root,
			false,
			env
		);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: 'review',
			result: { text: 'Offline Linux fixture finished ✓', changedFiles: ['src/orders.ts'] }
		});
	});
}

export async function verifyDockerOrchestrator(base: string) {
	await withDockerFixture(base, async (f, env) => {
		const brief = join(f.root, 'brief.md');
		await writeFile(brief, 'Run the isolated Linux fixture.');
		const result = await runHarness(
			[
				'task',
				'orchestrate',
				'--tracker=pilot1',
				`--brief=${brief}`,
				'--model=claude-haiku-5-5',
				'--platform=linux'
			],
			f.root,
			false,
			env
		);
		expect(result.exitCode, result.stderr || result.stdout).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			status: 'succeeded',
			sessions: [{ status: 'succeeded' }]
		});
		expect(await readFile(join(f.root, 'src/orders.ts'), 'utf8')).toContain('orders = 2');
	});
}

export async function verifyDockerProcess(base: string) {
	const root = await createTempDirectory('harness-docker-process-');
	try {
		const image = await runCommand(['docker', 'image', 'inspect', '--format={{.Id}}', base], root);
		const file = fileURLToPath(new URL('./managedProviderProcessFixture.ts', import.meta.url));
		const result = await runCommand(['bun', file, root], root, true, {
			HARNESS_TASK_DOCKER_IMAGE: image.stdout.trim(),
			HARNESS_RESOURCES_HOME: join(root, 'host-resource-state'),
			HARNESS_RESOURCE_LEASE: ''
		});
		expect(JSON.parse(result.stdout)).toEqual({
			exit: { code: 37, stdout: 'Prompt ✓\n[literal $(exit 91); * "]' },
			interrupted: 'interrupted',
			removed: true,
			recovered: true,
			legacyRecovered: true,
			liveBystanderPreserved: true,
			liveBystanderRemovedOnExit: true,
			cachedImagePreserved: true
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

async function withDockerFixture(
	base: string,
	check: (
		fixture: Awaited<ReturnType<typeof moduleTaskFixture>>,
		env: Record<string, string>
	) => Promise<void>
) {
	if (!/^[\w./:-]+$/.test(base))
		throw new Error('Expected a local Docker fixture base image name.');
	const fixture = await moduleTaskFixture();
	const image = `harness-managed-provider-test:${randomUUID()}`;
	try {
		await runCommand(['docker', 'image', 'inspect', '--format={{.Id}}', base], fixture.root);
		await writeFile(join(fixture.root, 'claude-fixture'), fixtureSource, { mode: 0o755 });
		await writeFile(
			join(fixture.root, 'Dockerfile'),
			`FROM ${base}\nCOPY claude-fixture /usr/local/bin/claude\n`
		);
		await writeFile(join(fixture.root, '.dockerignore'), '*\n!Dockerfile\n!claude-fixture\n');
		await runCommand(
			['docker', 'build', '--network=none', '--pull=false', '-t', image, '.'],
			fixture.root
		);
		const id = await runCommand(
			['docker', 'image', 'inspect', '--format={{.Id}}', image],
			fixture.root
		);
		await check(fixture, {
			HARNESS_TASK_DOCKER_IMAGE: id.stdout.trim(),
			ANTHROPIC_API_KEY: 'synthetic-leak-canary'
		});
	} finally {
		await runCommand(['docker', 'image', 'rm', image], fixture.root, false);
		await fixture.dispose();
	}
}
