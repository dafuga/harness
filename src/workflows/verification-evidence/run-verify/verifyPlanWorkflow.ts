// @harness-uid u_e6c8pw4a7t
import type { VerifyOptions } from './runVerify.types';
import { resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import {
	defaultVerifyConfig,
	verifyConfigFile,
	verifyConfigSchema,
	type VerifyConfig
} from '../../../core/verification-evidence/verifyTypes';
import { UnitRuntimeService } from '../../../services/execution-runtimes/UnitRuntimeService';
import { ImpactService } from '../../../services/reports-media/impact-service/ImpactService';
import { TrustedBaseService } from './TrustedBaseService';
import { scopedImpact, verifyEnv } from './scopedVerify';
import { openRange } from '../../development-tooling/loadRevisions';
import { runtimeKind } from '../../development-tooling/runImpact';
import { VerificationService } from './verification-service/VerificationService';
import { verifyPlanReport, type VerifyPlanReport } from './verification-service/verifyPlanReport';

interface LocalPlanInput {
	git: GitAdapter;
	commit: string;
	options: VerifyOptions & { root: string };
	runtime: ReturnType<UnitRuntimeService['kernel']>;
	context: {
		baseCommit: string | null;
		baseRecord: string | undefined;
		requestedBase: string | null;
		base: Awaited<ReturnType<typeof openRange>>['base'];
		head: Awaited<ReturnType<typeof openRange>>['head'];
		entity?: string;
	};
}

/** Computes selected checks without restoring evidence or running any planned check commands. */
export async function verifyPlan(options: VerifyOptions = {}): Promise<VerifyPlanReport> {
	const root = resolve(options.root ?? process.cwd());
	const git = new GitAdapter(root);
	if (!(await git.isRepository())) return fail('harness verify needs a Git repository.');
	if (options.runtime === 'http') {
		return fail('harness verify plan is local-only and cannot use the http impact runtime.');
	}
	const commit = await resolveCommit(git, options.commit ?? 'HEAD');
	return options.entity
		? planEntity(git, commit, { ...options, root })
		: planFull(git, commit, { ...options, root });
}

async function planFull(
	git: GitAdapter,
	commit: string,
	options: VerifyOptions & { root: string }
) {
	const localBase = await localTrustedBase(git, commit, options);
	const { requestedBase, proven } = localBase;
	const baseCommit = proven?.commit ?? null;
	const { base, head } = await openRange({
		root: options.root,
		base: baseCommit ?? 'none',
		head: commit
	});
	const runtime = new UnitRuntimeService(options.root).kernel(runtimeKind(options.runtime));
	const plan = await localPlan({
		git,
		commit,
		options,
		runtime,
		context: { baseCommit, baseRecord: proven?.record, requestedBase, base, head }
	});
	return verifyPlanReport(plan, {
		commit,
		base: baseCommit,
		requestedBase,
		runtime: runtime.kind,
		scope: 'full',
		baseResolution: localBase.resolution,
		selectionNote: localBase.note
	});
}

async function localTrustedBase(
	git: GitAdapter,
	commit: string,
	options: VerifyOptions & { root: string }
) {
	const parent =
		options.base ?? (await git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^`]));
	const requestedBase = !parent || parent === 'none' ? null : await resolveCommit(git, parent);
	const proven = requestedBase
		? await new TrustedBaseService(options.root).nearestRecord(requestedBase)
		: null;
	if (proven) {
		return {
			requestedBase,
			proven,
			resolution: 'local-cache' as const,
			note: 'Uses the nearest passing base already in local cache. A run may restore a newer attached base and select fewer checks.'
		};
	}
	return {
		requestedBase,
		proven,
		resolution: 'empty-conservative' as const,
		note: 'No locally cached passing base was provable without restoring evidence. Planned from an empty base; a run may restore proof and select fewer checks.'
	};
}

async function planEntity(
	git: GitAdapter,
	commit: string,
	options: VerifyOptions & { root: string }
) {
	const { head } = await openRange({ root: options.root, base: 'none', head: commit });
	const runtime = new UnitRuntimeService(options.root).kernel(runtimeKind(options.runtime));
	const plan = await localPlan({
		git,
		commit,
		options,
		runtime,
		context: {
			baseCommit: null,
			baseRecord: undefined,
			requestedBase: null,
			base: head,
			head,
			entity: options.entity
		}
	});
	return verifyPlanReport(plan, {
		commit,
		base: null,
		requestedBase: null,
		runtime: runtime.kind,
		scope: 'entity',
		entity: options.entity,
		baseResolution: 'entity',
		selectionNote: 'Entity planning uses the same scoped scenario selection as verify run --entity.'
	});
}

async function localPlan(input: LocalPlanInput) {
	const { git, commit, options, runtime, context } = input;
	try {
		const impact = context.entity
			? scopedImpact(commit, runtime.kind)
			: await new ImpactService(runtime).compute(context.base, context.head);
		return new VerificationService({
			root: options.root,
			commit,
			tree: await git.run(['rev-parse', `${commit}^{tree}`]),
			...context,
			impact,
			config: await verifyConfig(context.head),
			requirePerformance: context.entity ? false : undefined,
			testTimeoutMs: options.testTimeout ? Number(options.testTimeout) : undefined,
			entity: context.entity,
			env: verifyEnv(options),
			explained: () => Promise.resolve({ required: [], entries: [], overlong: [], failures: [] })
		}).plan();
	} finally {
		await runtime.close();
	}
}

async function verifyConfig(
	head: Awaited<ReturnType<typeof openRange>>['head']
): Promise<VerifyConfig> {
	const listed = head.entries.some((entry) => entry.path === verifyConfigFile);
	if (!listed || !head.tree) return defaultVerifyConfig;
	const parsed = verifyConfigSchema.safeParse(JSON.parse(await head.tree.read(verifyConfigFile)));
	if (parsed.success) return parsed.data;
	const issue = parsed.error.issues[0];
	return fail(`${verifyConfigFile} is invalid: ${issue.path.join('.')} ${issue.message}`);
}

async function resolveCommit(git: GitAdapter, reference: string): Promise<string> {
	const commit = await git.attempt(['rev-parse', '--verify', '--quiet', `${reference}^{commit}`]);
	return commit ?? fail(`"${reference}" does not name a commit in this repository.`);
}
