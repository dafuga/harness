// @harness-uid u_hmagdhwxab
import { resourcePriority } from '../../../core/execution-runtimes/resourceTypes';
import type { ImpactReport } from '../../../core/development-tooling/impactTypes';
import type { StoredRecord } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import type { VerifyOptions, VerifyResult } from './runVerify.types';
import { VerificationService } from './verification-service/VerificationService';
import type { Base } from './scopedVerify.types';
import { scopeFailure } from './verification-service/entityScope';
import { EvidenceAttachService } from '../../../services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { EvidenceRestoreService } from '../../../services/verification-evidence/EvidenceRestoreService';
import { VerificationCheckService } from '../../../services/verification-evidence/VerificationCheckService';
import { HistoryNoteRepository } from '../../../repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { VerificationStoreRepository } from '../../../repositories/verification-evidence/VerificationStoreRepository';

/** A scoped run checks one entity's states only: no impact analysis, reasons or base proof. */
export async function scopedVerify(
	context: Base,
	runtime: ImpactReport['runtime'],
	options: VerifyOptions,
	env: Record<string, string | undefined>
): Promise<VerifyResult> {
	const stored = await new VerificationService({
		...scopedContext(context),
		impact: scopedImpact(context.commit, runtime),
		requirePerformance: false,
		testTimeoutMs: options.testTimeout ? Number(options.testTimeout) : undefined,
		entity: options.entity,
		env,
		explained: () => Promise.resolve({ required: [], entries: [], overlong: [], failures: [] })
	}).run();
	return attachEntity(context.root, options.entity!, stored);
}

/** Publish nothing until every entity check and required slot has passed in the snapshot. */
async function attachEntity(
	root: string,
	entity: string,
	stored: StoredRecord
): Promise<VerifyResult> {
	const shots = screenshots(stored);
	const attachment: NonNullable<VerifyResult['attachment']> = {
		status: 'skipped',
		entity,
		record: stored.record.id,
		states: [...new Set(shots.map((shot) => shot.state))].sort(),
		viewports: [...new Set(shots.map((shot) => shot.capture.viewport!))].sort()
	};
	if (!completeEntity(stored, entity)) {
		process.stderr.write(
			`No screenshots attached for ${entity}: entity verification failed or is incomplete.\n`
		);
		return { ...stored, attachment };
	}
	await new EvidenceRestoreService(root).restore();
	const previous = await identicalProof(root, entity, stored);
	const attached = await new EvidenceAttachService(root).attach(
		stored.record.source.commit,
		previous ?? stored
	);
	attachment.status = attached.created ? 'attached' : 'unchanged';
	attachment.record = attached.record;
	return { ...stored, attachment };
}

function screenshots(stored: StoredRecord) {
	return stored.record.scenarios.flatMap((scenario) =>
		scenario.states.flatMap((state) =>
			state.captures
				.filter((capture) => capture.kind === 'screenshot')
				.map((capture) => ({ scenario: scenario.id, state: state.id, capture }))
		)
	);
}

function completeEntity(stored: StoredRecord, entity: string): boolean {
	const { record } = stored;
	return (
		record.tests.length > 0 &&
		record.tests.every((test) => test.status === 'passed') &&
		record.failures.every((failure) => failure === scopeFailure(entity)) &&
		record.scenarios.length > 0 &&
		record.scenarios.every((scenario) => scenario.status === 'passed') &&
		screenshots(stored).length > 0
	);
}

/** Reuse only intact, already attached proof of the same entity, profile and screenshot slots. */
async function identicalProof(root: string, entity: string, stored: StoredRecord) {
	const { record } = stored;
	const notes = await new HistoryNoteRepository(root).read(record.source.commit);
	const store = new VerificationStoreRepository(root);
	const checker = new VerificationCheckService(root);
	for (const note of notes.entries) {
		if (note.kind !== 'verification') continue;
		const previous = store.load(note.record);
		if (previous?.record.profile.id !== record.profile.id || !completeEntity(previous, entity))
			continue;
		if (proofSlots(previous) !== proofSlots(stored)) continue;
		if ((await checker.integrity(record.source.commit, previous)).length === 0) return previous;
	}
	return undefined;
}

function proofSlots(stored: StoredRecord): string {
	return JSON.stringify(
		screenshots(stored)
			.map(({ scenario, state, capture }) => [
				scenario,
				state,
				capture.evidence,
				capture.viewport,
				capture.sha256,
				capture.bytes,
				capture.mediaType,
				capture.server?.revision,
				capture.server?.buildId
			])
			.sort()
	);
}

export function renderAttachment(attachment: VerifyResult['attachment']): string[] {
	if (!attachment) return [];
	const { status, entity, states, viewports, record } = attachment;
	if (status === 'skipped')
		return [`No screenshots attached for ${entity}: failed or incomplete run.`];
	return [
		`Screenshots ${status} for ${entity}: states ${states.join(', ')}; viewports ${viewports.join(', ')}; record ${record}.`
	];
}

/** Scoped evidence does not reopen repository-wide ledger and retirement checks from an empty base. */
export function scopedContext(context: Base): Base {
	return { ...context, base: context.head };
}

function scopedImpact(head: string, runtime: ImpactReport['runtime']): ImpactReport {
	const units = { direct: [], indirect: [], added: [], removed: [] };
	const tests = { selected: [], excluded: [], removed: [] };
	const scenarios = { affected: [], unaffected: [] };
	return {
		base: 'none',
		head,
		runtime,
		expanded: false,
		changed: [],
		units,
		tests,
		scenarios,
		uncertain: []
	};
}
/** Step timings on stderr for scoped runs, which are meant to take seconds. */
export function timer(entity: string | undefined): (step: string) => void {
	const start = Date.now();
	return (step) => {
		if (entity) process.stderr.write(`[verify ${entity}] ${step} +${Date.now() - start}ms\n`);
	};
}
function verificationPriority(priority: string | undefined): string {
	return resourcePriority.parse(priority ?? process.env.HARNESS_RESOURCE_PRIORITY ?? 'environment');
}
/** A scoped run tells its checks so, so they are admitted under memory pressure. */
export function verifyEnv(options: VerifyOptions): Record<string, string | undefined> {
	const env = { ...process.env, HARNESS_RESOURCE_PRIORITY: verificationPriority(options.priority) };
	return options.entity ? { ...env, HARNESS_VERIFY_ENTITY: options.entity } : env;
}
