import type { VerifyOptions } from './runVerify.types';
export type { VerifyOptions } from './runVerify.types';
import { resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import { resourcePriority } from '../../../core/execution-runtimes/resourceTypes';
import {
	defaultVerifyConfig,
	verifyConfigFile,
	verifyConfigSchema,
	type VerifyConfig
} from '../../../core/verification-evidence/verifyTypes';
import { ExplanationRepository } from '../../../repositories/verification-evidence/ExplanationRepository';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../repositories/verification-evidence/VerificationStoreRepository';
import { ReasonPathService } from '../../../services/development-tooling/ReasonPathService';
import { UnitRuntimeService } from '../../../services/execution-runtimes/UnitRuntimeService';
import { CommitMessageService } from '../../../services/git-source-history/commit-message-service/CommitMessageService';
import { ImpactService } from '../../../services/reports-media/impact-service/ImpactService';
import {
	BuildIdentityService,
	type IdentifiedBuild
} from '../../../services/verification-evidence/BuildIdentityService';
import { EvidenceRestoreService } from '../../../services/verification-evidence/EvidenceRestoreService';
import {
	VerificationCheckService,
	type CheckReport
} from '../../../services/verification-evidence/VerificationCheckService';
import {
	commitLoader,
	openRange,
	type RevisionSide
} from '../../development-tooling/loadRevisions';
import { runtimeKind } from '../../development-tooling/runImpact';
import { TrustedBaseService } from './TrustedBaseService';
import { VerificationService } from './verification-service/VerificationService';

async function resolveCommit(git: GitAdapter, reference: string): Promise<string> {
	const commit = await git.attempt(['rev-parse', '--verify', '--quiet', `${reference}^{commit}`]);
	return commit ?? fail(`"${reference}" does not name a commit in this repository.`);
}

/**
 * The base that was asked for, and the nearest revision a passing record proves. Records
 * attached in Git are restored first, so a fresh clone builds on what is already proven.
 */
async function provenBase(git: GitAdapter, commit: string, base: string | undefined) {
	const parent = base ?? (await git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^`]));
	const requestedBase = !parent || parent === 'none' ? null : await resolveCommit(git, parent);
	await new EvidenceRestoreService(git.root).restore();
	const proven = await new TrustedBaseService(git.root).nearestRecord(requestedBase);
	return { requestedBase, proven };
}

/** Verifies one exact commit in a clean snapshot; the record is stored even when it fails. */
export async function verifyRun(options: VerifyOptions = {}): Promise<StoredRecord> {
	const root = resolve(options.root ?? process.cwd());
	const git = new GitAdapter(root);
	if (!(await git.isRepository())) return fail('harness verify needs a Git repository.');
	const commit = await resolveCommit(git, options.commit ?? 'HEAD');
	const { requestedBase, proven } = await provenBase(git, commit, options.base);
	const baseCommit = proven?.commit ?? null;
	const { base, head } = await openRange({ root, base: baseCommit ?? 'none', head: commit });
	const runtime = new UnitRuntimeService(root).kernel(runtimeKind(options.runtime));
	const config = await verifyConfig(head);
	const impact = await new ImpactService(runtime)
		.compute(base, head)
		.finally(() => runtime.close());
	return new VerificationService({
		root,
		commit,
		tree: await git.run(['rev-parse', `${commit}^{tree}`]),
		baseCommit,
		baseRecord: proven?.record,
		requestedBase,
		base,
		head,
		impact,
		config,
		requirePerformance: requiresPerformance(options, config),
		testTimeoutMs: options.testTimeout ? Number(options.testTimeout) : undefined,
		env: {
			...process.env,
			HARNESS_RESOURCE_PRIORITY: verificationPriority(options.priority)
		},
		// What was written about the range is held to the writing limits: its reasons, and the
		// stored messages of its commits, so a commit made past the hook does not pass.
		explained: async () =>
			new CommitMessageService(root).reported(
				await new ReasonPathService(root, commitLoader(root)).report(
					{ base, head, baseCommit, headCommit: commit },
					await new ExplanationRepository(root).all()
				),
				baseCommit,
				commit
			)
	}).run();
}

async function verifyConfig(head: RevisionSide): Promise<VerifyConfig> {
	const listed = head.entries.some((entry) => entry.path === verifyConfigFile);
	if (!listed || !head.tree) return defaultVerifyConfig;
	const parsed = verifyConfigSchema.safeParse(JSON.parse(await head.tree.read(verifyConfigFile)));
	if (parsed.success) return parsed.data;
	const issue = parsed.error.issues[0];
	return fail(`${verifyConfigFile} is invalid: ${issue.path.join('.')} ${issue.message}`);
}

/** Checks that a stored record proves a commit: the gate hooks and CI will rely on. */
export async function verifyCheck(options: VerifyOptions = {}): Promise<CheckReport> {
	const root = resolve(options.root ?? process.cwd());
	const commit = await resolveCommit(new GitAdapter(root), options.commit ?? 'HEAD');
	await new EvidenceRestoreService(root).restore();
	const store = new VerificationStoreRepository(root);
	const stored = options.record ? store.load(options.record) : store.latest(commit);
	if (!stored) {
		return fail(
			options.record
				? `${options.record} is not a verification record.`
				: `No verification record exists for ${commit}; run harness verify run.`
		);
	}
	return new VerificationCheckService(root).check(commit, stored);
}

/** The identity of a compiled build directory, as the server that serves it should report it. */
export async function verifyIdentity(
	directory: string
): Promise<IdentifiedBuild & { directory: string }> {
	const target = resolve(directory);
	const build = await new BuildIdentityService().identify(target);
	return build ? { directory: target, ...build } : fail(`${directory} holds no built files.`);
}

/** Stamps a compiled directory with the identity of its files, for a server that reports it. */
export async function verifyStamp(
	directory: string
): Promise<IdentifiedBuild & { directory: string }> {
	const target = resolve(directory);
	return { directory: target, ...(await new BuildIdentityService().stamp(target)) };
}

export function renderVerify(stored: StoredRecord): string {
	const { record } = stored;
	const ran = record.scenarios.filter((scenario) => scenario.status !== 'referenced').length;
	const { base, requestedBase } = record.source;
	const widened = requestedBase
		? [
				`Compared with ${base ?? 'an empty tree'}: ${requestedBase} has no passing record, so everything since the last verified revision was checked.`
			]
		: [];
	return [
		`Verification ${record.status} for ${record.source.commit}.`,
		...widened,
		`Tests: ${record.tests.length} run. Scenarios: ${ran} verified, ${record.scenarios.length - ran} referenced.`,
		...record.failures.map((failure) => `  ${failure}`),
		`Record ${record.id.slice(0, 12)} in ${stored.directory}`
	].join('\n');
}

function requiresPerformance(options: VerifyOptions, config: VerifyConfig): boolean {
	return options.requirePerformance === true || config.performanceRequired === 1;
}

function verificationPriority(priority: string | undefined): string {
	return resourcePriority.parse(priority ?? process.env.HARNESS_RESOURCE_PRIORITY ?? 'environment');
}
