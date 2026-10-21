import { performanceTolerance, type RuntimeKind } from '../../core/development-tooling/unitTypes';
import type { Measurement } from '../../core/verification-evidence/verificationTypes';

export interface RuntimeChoiceInput {
	measurements: Array<Omit<Measurement, 'testedRevision'>>;
	workload: string;
	profile: string;
}

export interface RuntimeChoice {
	runtime: RuntimeKind;
	/** `unmeasured` means no usable measurement exists and the reference was kept. */
	basis: 'measured' | 'unmeasured';
	workload: string;
	profile: string;
	rule: string;
	candidates: Array<{ runtime: RuntimeKind; coldMs: number }>;
	excluded: Array<{ runtime: RuntimeKind; reason: string }>;
}

/** Simplest first: the order that breaks a tie. */
const automatic: RuntimeKind[] = ['module', 'wasm', 'process'];
const metric = 'latency-cold-ms';
const rule =
	'Lowest median cold end-to-end latency on the representative workload for this profile; ' +
	'within 5% the simpler runtime wins (module, then wasm, then process). ' +
	'Unmeasured or unavailable runtimes are never chosen.';

/** Picks the default runtime from measurements; nothing is assumed about any implementation. */
export function chooseRuntime(input: RuntimeChoiceInput): RuntimeChoice {
	const matching = input.measurements.filter(
		(item) =>
			item.metric === metric && item.workload === input.workload && item.profile === input.profile
	);
	const found = (runtime: RuntimeKind) => matching.find((item) => item.target === runtime);
	const candidates = automatic.flatMap((runtime) => {
		const value = found(runtime)?.value;
		return typeof value === 'number' ? [{ runtime, coldMs: value }] : [];
	});
	const excluded = automatic
		.filter((runtime) => !candidates.some((candidate) => candidate.runtime === runtime))
		.map((runtime) => ({
			runtime,
			reason: found(runtime)?.unavailable ?? 'No measurement for this workload and profile.'
		}));
	const served = found('http')
		? [
				{
					runtime: 'http' as const,
					reason: 'Needs an independently served unit; never chosen automatically.'
				}
			]
		: [];
	const fastest = Math.min(...candidates.map((candidate) => candidate.coldMs));
	const winner = candidates.find(
		(candidate) => candidate.coldMs <= fastest * (1 + performanceTolerance)
	);
	return {
		runtime: winner?.runtime ?? 'module',
		basis: winner ? 'measured' : 'unmeasured',
		workload: input.workload,
		profile: input.profile,
		rule,
		candidates,
		excluded: [...excluded, ...served]
	};
}
