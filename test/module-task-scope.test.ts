import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskService } from '../src/services/agents-providers/ModuleTaskService';
import type { Prepared, ProjectWork } from './module-task-scope.test.types';

const feature = {
	id: 'contract-first-execution',
	goal: 'Harness users and agents develop from committed contracts; server-managed workers can read app-wide contracts and modify only their assigned files, with complete metadata validation and tracked executions.',
	tldr: 'Extend the API-backed CLI and mandatory revision metadata with contract authoring, contract-first Codex guidance, enforced worker scopes, and automatic server task creation and dispatch. Preserve local and hosted permissions, existing history and exact model/usage/cost/bounce records.'
};
const moduleId = 'service.scope-admission-fixture';
const sourceFiles = ['src/worker.ts', 'src/helper.ts', 'src/Case.ts'];
const verificationFiles = ['test/worker.test.ts', 'test/helper.test.ts'];
const wantedContract = {
	responsibility: 'Prepare tasks with an exact role-specific file grant.',
	inputs: [{ name: 'task', type: 'ModuleTaskInput' }],
	outputs: [{ name: 'prepared', type: 'PreparedModuleTask' }],
	errors: [{ name: 'unsafe grant', type: 'admission rejection' }]
};

async function writeFileUnder(root: string, path: string, text = 'fixture'): Promise<void> {
	const file = join(root, path);
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, text);
}

async function writeFixtureTree(root: string, outside: string): Promise<void> {
	await mkdir(root);
	await mkdir(outside);
	for (const path of [...sourceFiles, ...verificationFiles, 'src/unowned.ts']) {
		await writeFileUnder(root, path);
	}
	await writeFileUnder(outside, 'worker.ts');
	await symlink('worker.ts', join(root, 'src/link.ts'));
	await symlink(outside, join(root, 'escape'));
}

function fixtureManifest(includeUnsafeOwnership: boolean) {
	const unsafeFiles = ['src/missing.ts', 'src/link.ts', 'escape/worker.ts'];
	return {
		schemaVersion: 1,
		id: moduleId,
		kind: 'service',
		title: 'Scope admission fixture',
		responsibility: 'Own the fixture source files used by scope admission.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: {
			source: [...sourceFiles, ...(includeUnsafeOwnership ? unsafeFiles : [])],
			symbols: ['scopeFixture']
		},
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: 'scopeFixture', type: 'string' }],
			errors: []
		},
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: sourceFiles[0],
			targets: [{ kind: 'module', entry: sourceFiles[0] }]
		},
		scenarios: ['module-tasks'],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

function commitFixture(root: string): void {
	execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
	execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
	execFileSync(
		'git',
		[
			'-c',
			'user.name=Harness Fixture',
			'-c',
			'user.email=harness-fixture@example.invalid',
			'commit',
			'-m',
			'fixture'
		],
		{ cwd: root, stdio: 'ignore' }
	);
}

async function withProject(work: ProjectWork, includeUnsafeOwnership = false): Promise<void> {
	const temporary = await mkdtemp(join(tmpdir(), 'harness-task-scope-'));
	const root = join(temporary, 'project');
	const outside = join(temporary, 'outside');
	try {
		await writeFixtureTree(root, outside);
		await writeFileUnder(
			root,
			`specification/units/${moduleId}.json`,
			JSON.stringify(fixtureManifest(includeUnsafeOwnership), null, 2)
		);
		commitFixture(root);
		const service = new ModuleTaskService(root);
		await service.feature(feature);
		await work(service);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

function taskInput(id: string, extra: Record<string, unknown> = {}) {
	return {
		id: `scope-${id}`,
		title: 'Exact scope admission fixture',
		feature: feature.id,
		module: moduleId,
		instructions: 'Complete only the assigned work.',
		wantedContract,
		model: 'gpt-6-luna',
		provider: 'codex',
		intelligence: 'max',
		...extra
	};
}

function expectPrepared(prepared: Prepared, role: Prepared['role'], files: string[]): void {
	expect(prepared.role).toBe(role);
	expect(prepared.files).toEqual(files);
	expect(prepared.selection).toMatchObject({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max'
	});
	expect(
		prepared.prompt.startsWith(`Overall goal: ${feature.goal}\nFeature TLDR: ${feature.tldr}\n`)
	).toBe(true);
	for (const rule of [
		/(?:app-wide|across the app).{0,60}contracts|contracts.{0,60}(?:app-wide|across the app)/i,
		/(?:only.{0,50}assigned|assigned.{0,50}only).{0,30}files/i,
		/(?:do not|must not|cannot).{0,30}commit/i,
		/(?:do not|must not|cannot).{0,40}(?:escalate|expand.{0,20}scope)/i,
		/(?:do not|must not|cannot).{0,30}(?:accept|approve).{0,30}own|self.{0,20}accept/i
	]) {
		expect(prepared.prompt).toMatch(rule);
	}
}

test('implementation tasks freeze exact source grants and exclude verification context', async () => {
	await withProject(async (service) => {
		const added = await service.add(
			taskInput('selected-implementation', {
				role: 'implementation',
				assignedFiles: [sourceFiles[0]],
				verificationFiles: [verificationFiles[0]]
			})
		);
		expect(added.task.module.files).toEqual([sourceFiles[0]]);
		const prepared = service.prepare(added.task, added.commit!) as Prepared;
		expectPrepared(prepared, 'implementation', [sourceFiles[0]]);
	});
});

test('verification tasks grant only their selected verification files', async () => {
	await withProject(async (service) => {
		const added = await service.add(
			taskInput('selected-verification', {
				role: 'verification',
				verificationFiles,
				assignedFiles: [verificationFiles[1]]
			})
		);
		expect(added.task.module.files).toEqual([verificationFiles[1]]);
		const prepared = service.prepare(added.task, added.commit!) as Prepared;
		expectPrepared(prepared, 'verification', [verificationFiles[1]]);
	});
});

test('legacy mixed module files default to safe owned source only', async () => {
	await withProject(async (service) => {
		const added = await service.add(
			taskInput('legacy-default', { verificationFiles: [verificationFiles[0]] })
		);
		expect(added.task.module.files).toEqual(sourceFiles);
		const legacy = {
			...added.task,
			module: { ...added.task.module, files: [...sourceFiles, verificationFiles[0]] }
		};
		Reflect.deleteProperty(legacy, 'role');
		const prepared = service.prepare(legacy, added.commit!) as Prepared;
		expectPrepared(prepared, 'implementation', sourceFiles);
	});
});

test('unsafe and mixed-role grants reject before queue mutation', async () => {
	await withProject(async (service) => {
		const failures: [string, Record<string, unknown>][] = [
			['unowned', { assignedFiles: ['src/unowned.ts'] }],
			['directory', { assignedFiles: ['src'] }],
			['missing', { assignedFiles: ['src/missing.ts'] }],
			['symlink', { assignedFiles: ['src/link.ts'] }],
			['symlink-parent', { assignedFiles: ['escape/worker.ts'] }],
			['git', { assignedFiles: ['.git/config'] }],
			['duplicate', { assignedFiles: [sourceFiles[0], sourceFiles[0]] }],
			['case-alias', { assignedFiles: ['src/case.ts'] }],
			['implementation-test', { assignedFiles: [verificationFiles[0]], verificationFiles }],
			[
				'verification-source',
				{ role: 'verification', verificationFiles, assignedFiles: [sourceFiles[0]] }
			],
			['scope-injection', { scope: { files: [verificationFiles[0]], role: 'verification' } }]
		];
		for (const [id, extra] of failures) {
			const before = await service.list();
			await expect(
				service.add(taskInput(id, { role: 'implementation', ...extra }))
			).rejects.toThrow();
			expect(await service.list()).toEqual(before);
		}
	}, true);
});
