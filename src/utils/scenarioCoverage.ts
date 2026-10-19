import type { ScenarioManifest } from '../core/unitTypes';
import type { ScenarioResult } from '../core/verificationTypes';
import { benchmarkCaptureSchema, verifyConfigFile } from '../core/verifyTypes';
import type { Gathered } from './gatherCaptures';
import type { MediaFacts } from './mediaFacts';
import { scenarioRequirements } from './scenarioRequirements';

export interface CoverageInput {
	scenario: ScenarioManifest;
	/** The exact commit being verified; captures must come from a build of it. */
	commit: string;
	gathered: Gathered[];
	/** True when a check that produced these captures failed or timed out. */
	checkFailed: boolean;
	/** The builds the project declares, and the identity of each one setup compiled. */
	builds?: { declared: string[]; compiled: Map<string, string> };
}

export interface CoverageResult {
	states: ScenarioResult['states'];
	failures: string[];
}

type Evidence = ScenarioManifest['evidence'][number];
type Viewport = ScenarioManifest['viewports'][number];
const durationTolerance = 0.05;

/** Judges gathered captures against the scenario contract: completeness, validity, freshness. */
export function scenarioCoverage(input: CoverageInput): CoverageResult {
	const { scenario, gathered } = input;
	const requirements = scenarioRequirements(scenario);
	const problems = new Map(gathered.map((item) => [item, problem(input, item)]));
	const absent = requirements.required
		.filter((need) => !gathered.some((item) => matches(item, need)))
		.map((need) => {
			const where = need.viewport ? ` at viewport ${need.viewport}` : '';
			return `missing ${need.kind} for state ${need.state}${where}`;
		});
	const failures = [
		...requirements.unproven.map(
			(item) => `state ${item.state} is declared missing: ${item.reason}`
		),
		...absent,
		...[...problems.values()].flatMap((found) => found ?? [])
	];
	const failed = (item: Gathered) => input.checkFailed || problems.get(item) !== undefined;
	const states = scenario.states.map((state) => ({
		id: state.id,
		coverage: state.coverage,
		...(state.reason ? { reason: state.reason } : {}),
		captures: gathered
			.filter((item) => item.line.state === state.id)
			.map((item) => ({
				...item.capture,
				status: failed(item) ? ('failed' as const) : ('passed' as const)
			}))
	}));
	return { states, failures: failures.map((failure) => `${scenario.id}: ${failure}`) };
}

function matches(
	item: Gathered,
	need: { evidence: string; state: string; viewport?: string }
): boolean {
	const { line } = item;
	return (
		line.evidence === need.evidence && line.state === need.state && line.viewport === need.viewport
	);
}

/** The first thing wrong with one capture, if anything. */
function problem(input: CoverageInput, item: Gathered): string | undefined {
	const evidence = input.scenario.evidence.find((entry) => entry.id === item.line.evidence);
	if (item.line.kind === 'screenshot') return imageProblem(input, item, evidence);
	if (item.line.kind === 'audio') return audioProblem(input, item, evidence);
	if (item.line.kind === 'benchmark') return benchmarkProblem(item);
	// An output, assertions or a trace that says it was captured from running software is bound
	// to the build that served it, as a screenshot is; one that claims none is taken as given.
	return item.line.provenance === 'actual-capture'
		? stampProblem(input, item, evidence)
		: undefined;
}

/** A benchmark capture must be measurements Harness can read, each context valid if stated. */
function benchmarkProblem(item: Gathered): string | undefined {
	const parsed = benchmarkCaptureSchema.safeParse(item.benchmark);
	if (parsed.success) return undefined;
	const [issue] = parsed.error.issues;
	const where = issue.path.join('.');
	return `capture ${item.line.file} is not a valid benchmark: ${where} ${issue.message}`.trim();
}

function factsError(facts: MediaFacts | undefined, fallback: string): string {
	return facts && 'error' in facts ? facts.error : fallback;
}

function imageProblem(
	input: CoverageInput,
	item: Gathered,
	evidence?: Evidence
): string | undefined {
	const { facts, line } = item;
	if (!facts || !('kind' in facts) || facts.kind !== 'image') {
		return `capture ${line.file} is not a valid PNG image: ${factsError(facts, 'not an image')}`;
	}
	const viewport = input.scenario.viewports.find((entry) => entry.id === line.viewport);
	const size = viewport
		? sizeProblem(facts, viewport, evidence?.capture === 'full-page')
		: undefined;
	return size ? `capture ${line.file} ${size}` : stampProblem(input, item, evidence);
}

/** A viewport capture has exactly the viewport's pixels; a full-page one is at least as tall. */
function sizeProblem(
	image: { width: number; height: number },
	viewport: Viewport,
	fullPage: boolean
): string | undefined {
	const scale = viewport.scale ?? 1;
	const width = viewport.width * scale;
	const height = viewport.height * scale;
	const tall = fullPage ? image.height >= height : image.height === height;
	if (image.width === width && tall) return undefined;
	const expected = fullPage ? `${width} wide and at least ${height} tall` : `${width}x${height}`;
	return `is ${image.width}x${image.height} but viewport ${viewport.id} requires ${expected}`;
}

function audioProblem(
	input: CoverageInput,
	item: Gathered,
	evidence?: Evidence
): string | undefined {
	const { facts, line } = item;
	if (!facts || !('kind' in facts) || facts.kind !== 'audio') {
		return `capture ${line.file} is not playable WAV audio: ${factsError(facts, 'not audio')}`;
	}
	const declared = line.durationSeconds ?? facts.durationSeconds;
	if (Math.abs(declared - facts.durationSeconds) > durationTolerance) {
		return `capture ${line.file} declares ${declared} s but contains ${facts.durationSeconds} s of audio`;
	}
	return describedProblem(line, evidence) ?? liveProblem(input, item, evidence);
}

/** Audio evidence needs a transcript and the provenance its contract names. */
function describedProblem(line: Gathered['line'], evidence?: Evidence): string | undefined {
	if (!line.transcript?.trim()) return `audio capture for state ${line.state} has no transcript`;
	if (!evidence?.provenance || line.provenance === evidence.provenance) return undefined;
	const actual = line.provenance ?? 'none';
	return `audio capture for state ${line.state} has provenance ${actual}, not ${evidence.provenance}`;
}

function liveProblem(
	input: CoverageInput,
	item: Gathered,
	evidence?: Evidence
): string | undefined {
	return item.line.provenance === 'actual-capture'
		? stampProblem(input, item, evidence)
		: undefined;
}

/**
 * A capture of running software must name the build it came from: a build of this commit and,
 * when its evidence names a declared build, exactly the files setup compiled for it.
 */
function stampProblem(
	input: CoverageInput,
	item: Gathered,
	evidence?: Evidence
): string | undefined {
	const { file, server } = item.line;
	if (!server?.revision) return `capture ${file} has no build stamp`;
	if (server.revision !== input.commit) {
		return `capture ${file} was produced by revision ${server.revision}, not ${input.commit}`;
	}
	const problem = buildProblem(input.builds, server.buildId, evidence?.build);
	return problem ? `capture ${file} ${problem}` : undefined;
}

/** What ties a capture to compiled files: the declared build its evidence names. */
function buildProblem(
	builds: CoverageInput['builds'],
	served: string,
	named?: string
): string | undefined {
	const declared = builds?.declared ?? [];
	if (!named) {
		return declared.length > 0
			? `does not name the build that served it; ${verifyConfigFile} declares ${declared.join(', ')}`
			: undefined;
	}
	if (!declared.includes(named)) {
		return `names build ${named}, which ${verifyConfigFile} does not declare`;
	}
	const compiled = builds?.compiled.get(named);
	if (!compiled) return `names build ${named}, which setup did not produce`;
	if (served === compiled) return undefined;
	return `was served by build ${served.slice(0, 12)}, not the ${named} build ${compiled.slice(0, 12)} compiled from this revision`;
}
