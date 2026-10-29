import { resourcePriority } from '../../../core/execution-runtimes/resourceTypes';
import type { ImpactReport } from '../../../core/development-tooling/impactTypes';
import type { StoredRecord } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import type { VerifyOptions } from './runVerify.types';
import { VerificationService } from './verification-service/VerificationService';
import type { VerifyContext } from './verification-service/VerificationService.types';

type Base = Omit<
	VerifyContext,
	'impact' | 'requirePerformance' | 'testTimeoutMs' | 'entity' | 'env' | 'explained'
>;

/** A scoped run checks one entity's states only: no impact analysis, reasons or base proof. */
export function scopedVerify(
	context: Base,
	runtime: ImpactReport['runtime'],
	options: VerifyOptions,
	env: Record<string, string | undefined>
): Promise<StoredRecord> {
	return new VerificationService({
		...scopedContext(context),
		impact: scopedImpact(context.commit, runtime),
		requirePerformance: false,
		testTimeoutMs: options.testTimeout ? Number(options.testTimeout) : undefined,
		entity: options.entity,
		env,
		explained: () => Promise.resolve({ required: [], entries: [], overlong: [], failures: [] })
	}).run();
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
