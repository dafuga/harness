import { expect } from 'vitest';
import { runCommand, runHarness } from '../cli';
import { measureProcess } from '../cli-measurement/measureProcess';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
/** Preserve actual process facts while giving fast children time to exit during PID tracking. */
export async function observedLoop(root: string) {
	const bin = join(root, 'bin');
	await mkdir(bin);
	const ps = spawnSync('which', ['ps'], { encoding: 'utf8' }).stdout.trim();
	if (!ps) throw new Error('The process observer fixture requires the native ps executable.');
	await writeFile(
		join(bin, 'ps'),
		`#!/bin/sh\n"${ps}" "$@"\nstatus=$?\nsleep 0.15\nexit "$status"\n`,
		{ mode: 0o755 }
	);
	let status: number | null = null;
	const result = await measureProcess(
		{
			units: ['workflow.loop-evaluate', 'function.resource-work'],
			workload: 'fast-evaluators-with-native-tracking',
			target: 'module',
			command: ['bun', resolve('src/index.ts'), 'loop', 'evaluate', 'proof-loop', '--json'],
			cwd: root,
			env: {
				...process.env,
				PATH: bin + ':' + process.env.PATH,
				HARNESS_RESOURCES_HOME: join(root, 'resources'),
				HARNESS_RESOURCE_LEASE: ''
			},
			expectSuccess: false
		},
		async (command, cwd, _success, env) => {
			const ran = spawnSync(command[0], command.slice(1), {
				cwd,
				encoding: 'utf8',
				timeout: 5000,
				killSignal: 'SIGKILL',
				env
			});
			status = ran.status;
			return { exitCode: ran.status ?? 1, stdout: ran.stdout, stderr: ran.stderr };
		}
	);
	return { status, stdout: result.stdout, stderr: result.stderr };
}

/** Scoped real-capture admission resolves slots against the selected registry; fixtures stay explicit. */
export async function expectCaptureBindings(root: string): Promise<void> {
	const input = await bindingInputs(root);
	for (const name of [
		'known',
		'attachment',
		'unknown-direct',
		'selected-registry',
		'missing-slot',
		'missing-state',
		'missing-viewport',
		'unknown-mapping',
		'ambiguous',
		'unscoped'
	]) {
		await exerciseBinding(root, input, name);
	}
}

async function bindingInputs(root: string) {
	const path = join(root, 'specification/scenarios/sample-screen.json');
	const scenario = JSON.parse(await readFile(path, 'utf8'));
	const script = (await readFile(join(root, 'proof.ts'), 'utf8'))
		.replace("evidence:'page.sample'", "evidence:'function.sample'")
		.replace("provenance:'fixture'", "provenance:'actual-capture'");
	const unit = JSON.parse(
		await readFile(join(root, 'specification/units/function.sample.json'), 'utf8')
	);
	await writeFile(
		join(root, 'specification/units/function.attachment.json'),
		JSON.stringify({
			...unit,
			id: 'function.attachment',
			status: 'retired',
			retired: { reason: 'Synthetic attachment fixture.', at: '2026-10-24' }
		})
	);
	return { path, scenario, script };
}

async function exerciseBinding(
	root: string,
	input: Awaited<ReturnType<typeof bindingInputs>>,
	name: string
) {
	const replacements: Record<string, [string, string]> = {
		attachment: ["evidence:'function.sample'", "evidence:'function.attachment'"],
		'selected-registry': [
			"const screen={evidence:'function.sample'",
			"const screen={evidence:'future-unit'"
		],
		'unknown-direct': [
			"const screen={evidence:'function.sample'",
			"const screen={evidence:'unknown-unit'"
		],
		'missing-slot': ["evidence:'sample-screen'", "evidence:'unknown-slot'"],
		'missing-state': ["state:'overview'", "state:'uncovered'"],
		'missing-viewport': ["viewport:'desktop'", "viewport:'mobile'"],
		unscoped: ["evidence:'sample-screen'", "evidence:'unknown-slot'"]
	};
	const replacement = replacements[name];
	await writeFile(
		join(root, 'proof.ts'),
		replacement ? input.script.replace(...replacement) : input.script
	);
	await writeFile(
		input.path,
		JSON.stringify(
			name === 'unknown-mapping' ? { ...input.scenario, units: ['unknown-unit'] } : input.scenario
		)
	);
	const duplicate = join(root, 'specification/scenarios/duplicate.json');
	if (name === 'ambiguous')
		await writeFile(duplicate, JSON.stringify({ ...input.scenario, id: 'duplicate' }));
	else await rm(duplicate, { force: true });
	await runCommand(['git', 'add', '.'], root);
	await runCommand(
		['git', 'commit', '--allow-empty', '-qm', 'fix: exercise capture binding ' + name],
		root
	);
	const future = join(root, 'specification/units/future-unit.json');
	if (name === 'selected-registry') {
		const unit = JSON.parse(
			await readFile(join(root, 'specification/units/function.sample.json'), 'utf8')
		);
		await writeFile(future, JSON.stringify({ ...unit, id: 'future-unit' }));
	}
	try {
		await expectBindingResult(root, name);
	} finally {
		await rm(future, { force: true });
	}
}

async function expectBindingResult(root: string, name: string) {
	const scoped = name !== 'unscoped';
	const expected = ['known', 'attachment', 'unscoped'].includes(name) ? 0 : 1;
	const result = await runHarness(
		[
			'loop',
			'record',
			'repair',
			'--phase',
			'capture',
			'--test',
			'proof.ts',
			...(scoped ? ['--unit', 'function.sample'] : []),
			'--command',
			'bun proof.ts',
			'--json'
		],
		root,
		false
	);
	expect(result.exitCode, name + ': scoped actual captures must resolve to registered units').toBe(
		expected
	);
	if (expected) expect(result.stderr).toContain('Focused capture must resolve to registered units');
	else {
		const record = JSON.parse(result.stdout);
		expect(record.status).toBe('passed');
		expect(record.units).toEqual(scoped ? ['function.sample'] : []);
		expect(record.captures).toContainEqual(
			expect.objectContaining({
				unit: name === 'attachment' ? 'function.attachment' : 'function.sample'
			})
		);
	}
}
