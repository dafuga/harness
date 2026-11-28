// @harness-uid u_gs5pnxnxt4
import { parseUnpinned } from './trackerTaskRoutes';
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type {
	TrackerGeminiAdapter,
	TrackerModelEvidence,
	TrackerModelFailure
} from './trackerEscalation.types';

// No Gemini CLI launch route exists yet. Return its rung here once the launcher can start one.
const geminiLaunchAdapter: TrackerGeminiAdapter | undefined = undefined;

const efforts = ['low', 'medium', 'high', 'xhigh', 'max'];
const astra: TrackerModelRung = {
	id: 'astra',
	cli: 'codex',
	model: 'gpt-6.2-astra',
	effort: 'high',
	price: null
};

const rank = (effort: string | null) => {
	const index = efforts.indexOf(effort ?? '');
	return index < 0 ? efforts.length : index;
};

// An incident names a rung ("opus") or a model ("claude-opus-5-5"), with an optional effort.
function sameModel(model: string, named: string) {
	const [name] = named.toLowerCase().split(':');
	return model === name || model.split('-').includes(name);
}

/** The first step above every step of this route that already failed on the item. */
export function climbedStep(
	steps: readonly TrackerModelRung[],
	evidence?: TrackerModelEvidence
): number {
	const failed = [...(evidence?.failed ?? []), ...(evidence?.incidents ?? []).map(incidentFailure)];
	let next = 0;
	steps.forEach((step, index) => {
		const covered = failed.some(
			({ model, effort }) => sameModel(step.model, model) && rank(effort) >= rank(step.effort)
		);
		if (covered) next = index + 1;
	});
	return Math.min(next, steps.length - 1);
}

function incidentFailure(spec: string): TrackerModelFailure {
	const [model, effort] = spec.split(':');
	return { model, effort: effort ?? null };
}

/** Opus is struggling after two failed attempts on the item, or one model-quality incident. */
function opusStruggles({ failed, incidents }: TrackerModelEvidence) {
	const opus = (model: string) => sameModel('claude-opus-5-5', model);
	return failed.filter(({ model }) => opus(model)).length >= 2 || incidents.some(opus);
}

function struck(rung: TrackerModelRung, { failed, incidents }: TrackerModelEvidence) {
	return (
		failed.some(({ model }) => model === rung.model) ||
		incidents.some((named) => sameModel(rung.model, named))
	);
}

/** Fable, then Astra, then Gemini when it is switched on and has a launch route. */
export function escalationRungs(
	ladder: TrackerModelRung[],
	cfg?: TrackerLadderConfig,
	gemini: TrackerGeminiAdapter | undefined = geminiLaunchAdapter
): TrackerModelRung[] {
	const rungs = [parseUnpinned('fable:high', ladder), astra];
	const settings = cfg?.autolaunch?.gemini;
	return settings?.enabled && gemini ? [...rungs, gemini(settings.model)] : rungs;
}

/** The rung hard work moves to once Opus struggles, or undefined while it does not. */
export function hardEscalation(
	evidence: TrackerModelEvidence | undefined,
	{
		ladder,
		cfg,
		claudeOnly
	}: { ladder: TrackerModelRung[]; cfg?: TrackerLadderConfig; claudeOnly: boolean }
) {
	if (!evidence || !opusStruggles(evidence)) return undefined;
	const eligible = escalationRungs(ladder, cfg).filter(
		({ cli }) => !claudeOnly || cli === 'claude'
	);
	const rung = eligible.find((candidate) => !struck(candidate, evidence)) ?? eligible.at(-1)!;
	return { rung, why: `hard escalation after Opus struggled: ${rung.id} ${rung.effort}` };
}
