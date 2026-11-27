// @harness-uid u_sbz3zzk4fx
import {
	defaultVerifyConfig,
	verifyConfigFile,
	verifyConfigSchema
} from '../../src/core/verification-evidence/verifyTypes';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { SourceIndexService } from '../../src/services/development-tooling/source-index-service/SourceIndexService';
import { UnitRuntimeService } from '../../src/services/execution-runtimes/UnitRuntimeService';
import { ImpactService } from '../../src/services/reports-media/impact-service/ImpactService';
import { classifyPath } from '../../src/utils/accounts-access/classify-path/classifyPath';
import { loadSide } from '../../src/workflows/development-tooling/loadRevisions';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';
import {
	deferredLiteCheck,
	verifyPlan
} from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlan';
import { planCheck } from '../run-checks';
import type { CandidateTree, CheckPlan } from './sharedCheck.types';

const unitSmoke = 'test/resource-scripts.test.ts';
const broadBrowser = new Set([
	'test:e2e',
	'test:package',
	'check:reports-source',
	'check:desktop',
	'check:hub'
]);

export const installCheckDependencies = {
	id: 'setup:dependencies',
	command: ['bun', 'install', '--frozen-lockfile', '--network-concurrency', '1'],
	timeoutMs: 600_000
};

export async function checkPlan(candidate: CandidateTree, release: boolean): Promise<CheckPlan> {
	if (release) return broadPlan('release');
	try {
		if (candidate.base === candidate.commit) return await smokePlan(candidate);
		return await focusedPlan(candidate);
	} catch (error) {
		const reason = error instanceof Error ? error.name : 'unknown error';
		return broadPlan(
			'unknown',
			`Could not resolve the dependency graph or check plan (${reason}).`
		);
	}
}

async function smokePlan(candidate: CandidateTree): Promise<CheckPlan> {
	const source = await CommitTreeAdapter.open(candidate.repo, candidate.commit);
	const smoke = (await source.list()).some(({ path }) => path === unitSmoke);
	return {
		mode: 'focused',
		checks: [
			smoke
				? {
						id: unitSmoke,
						command: ['bun', 'x', '--no-install', 'vitest', 'run', unitSmoke]
					}
				: {
						id: 'smoke:git',
						command: ['git', 'diff', '--check', candidate.base, 'HEAD']
					}
		]
	};
}

function broadPlan(mode: 'release' | 'unknown', reason?: string): CheckPlan {
	const legacy = planCheck([]);
	return {
		mode,
		reason,
		checks: legacy.steps.map((id) => ({
			id,
			command: ['bun', ...legacy.command(id)],
			browser: broadBrowser.has(id),
			timeoutMs: 3_600_000
		}))
	};
}

async function focusedPlan(candidate: CandidateTree): Promise<CheckPlan> {
	const { repo, base: baseId, commit } = candidate;
	const indexer = new SourceIndexService();
	const base = await loadSide(repo, await CommitTreeAdapter.open(repo, baseId), indexer);
	const head = await loadSide(repo, await CommitTreeAdapter.open(repo, commit), indexer);
	const runtime = new UnitRuntimeService(repo).kernel('module');
	const impact = await new ImpactService(runtime)
		.compute(base, head)
		.finally(() => runtime.close());
	if (impact.expanded) {
		const reason = impact.uncertain.slice(0, 3).map(({ reason, node }) => `${reason}: ${node}`);
		return broadPlan('unknown', reason.join(', ') || 'Dependency graph widened test selection.');
	}
	const config = head.entries.some(({ path }) => path === verifyConfigFile)
		? verifyConfigSchema.parse(JSON.parse(await head.tree!.read(verifyConfigFile)))
		: defaultVerifyConfig;
	const affected = new Set(impact.scenarios.affected);
	const scenarios = head.scenarios.filter((scenario) => affected.has(scenario.id));
	const selectedTests = new Set(impact.tests.selected);
	const smoke = head.entries.some(({ path }) => path === unitSmoke);
	if (smoke) selectedTests.add(unitSmoke);
	const planned = verifyPlan({
		selectedTests: [...selectedTests],
		scenarios,
		config,
		unitsConfig: head.config
	});
	return {
		mode: 'focused',
		setup: checkSetup(scopedSetup(config.setup, neededBuilds(scenarios))),
		checks: [
			...(smoke
				? []
				: [
						{
							id: 'smoke:git',
							command: ['git', 'diff', '--check', candidate.base, 'HEAD']
						}
					]),
			...changedStaticFiles(
				impact.changed.filter(({ status }) => status !== 'removed').map(({ path }) => path),
				head.config
			),
			...planned.map((check) => ({
				id: check.id,
				cwd: check.cwd,
				command: ['/bin/sh', '-c', check.command],
				timeoutMs: check.timeoutMs,
				browser: deferredLiteCheck(check)
			}))
		]
	};
}

function checkSetup(steps: typeof defaultVerifyConfig.setup) {
	return steps.flatMap(({ command, timeoutMs, fullOnly }, index) => {
		if (/^bun install\b/.test(command)) return [];
		return [
			{ id: `setup:${index}`, command: ['/bin/sh', '-c', command], timeoutMs, browser: fullOnly }
		];
	});
}

function changedStaticFiles(paths: string[], config: Parameters<typeof classifyPath>[1]) {
	const byWorkspace = new Map<string, string[]>();
	for (const path of paths.filter((path) => /\.[cm]?[jt]sx?$/.test(path))) {
		const { workspaceRoot, relative } = classifyPath(path, config);
		const files = byWorkspace.get(workspaceRoot) ?? [];
		files.push(relative);
		byWorkspace.set(workspaceRoot, files);
	}
	return [...byWorkspace].flatMap(([cwd, files]) => {
		const lint = {
			id: `static:lint:${cwd}`,
			cwd,
			command: ['bun', 'x', '--no-install', 'eslint', '--no-warn-ignored', '--', ...files]
		};
		const typed = files.filter((path) => /\.[cm]?tsx?$/.test(path));
		const types = { id: `static:types:${cwd}`, cwd, command: ['tsc-files', ...typed] };
		return typed.length ? [lint, types] : [lint];
	});
}
