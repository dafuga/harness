// @harness-uid u_6owiaffoxw
import {
	classifyTrackerTask,
	floorReasons,
	isExplicitlyHard,
	isHarnessModule,
	isLightClaudeWork,
	sizeOf,
	trackerTaskRoute
} from './classifyTrackerTask';
import {
	trackerTaskTypes,
	type TrackerModelItem,
	type TrackerTaskType
} from './classifyTrackerTask.types';

// A coordinator is named by its role, never by a passing mention of one.
const coordinatorTitle = [
	/\[(?:coordinator|orchestrator|orchestration)\]/i,
	/^\W*(?:chief of staff|coordinator|orchestrator)(?:\s+(?:session|run|agent|duty|role))?\s*(?::|—|–| - |$)/i,
	/^\W*(?:coordinate|orchestrate|steer|supervise)\b/i,
	/^\W*write (?:the )?(?:[\w-]+ ){0,2}(?:module|interface|work|worker) contracts?\b/i
];
const coordinatorRole = /\byou are (?:the |a |an )(?:[\w-]+ ){0,2}(?:orchestrator|coordinator)\b/i;
// UI polish and restyling are build work, so they are not listed here.
const designTitle = [
	/\[design\]|\bdesign (?:review|canvas)\b|^\W*design\s*:/i,
	/^\W*(?:mock[ -]?ups?|wireframes?|designs? for|visual designs?|review (?:the )?designs)\b/i,
	/\b(?:design|redesign|build|create|draw|generate|review|revise|prepare)\b[^.!?\n;]*\b(?:mock[ -]?ups?|wireframes?|visual designs?)\b/i,
	/\b(?:design|redesign)\s+(?:the |a |an )?(?:[\w-]+ ){0,3}(?:screens?|ui|dashboard|pages?|views?|layouts?)\b/i
];
const systemDesign = /\b(?:schema|database|api|protocol|architecture|system design)\b/i;

export function isTrackerTaskType(value: unknown): value is TrackerTaskType {
	return trackerTaskTypes.includes(value as TrackerTaskType);
}

/** The type set with --kind, otherwise the one the title and brief describe. */
export function trackerTaskType(item: TrackerModelItem): TrackerTaskType {
	if (isTrackerTaskType(item.task_type)) return item.task_type;
	const route = trackerTaskRoute(item);
	if (route === 'live-deploy') return 'deploy';
	if (isCoordinator(item)) return 'coordinator';
	if (route === 'computer-use') return 'computer-use';
	if (isDesign(item.title ?? '')) return 'design';
	return workType(item);
}

// Mockups, visual design and design review. Only the title counts: this is the costliest route.
function isDesign(title: string) {
	if (systemDesign.test(title)) return false;
	const parts = [title, ...title.split(/[;\n]+|:\s+/)];
	return parts.some((part) => designTitle.some((rule) => rule.test(part.trim())));
}

function isCoordinator({ title, notes, brief }: TrackerModelItem) {
	return (
		coordinatorTitle.some((rule) => rule.test(title ?? '')) ||
		[title, notes, brief].some((text) => coordinatorRole.test(text ?? ''))
	);
}

function workType(item: TrackerModelItem): TrackerTaskType {
	const kind = classifyTrackerTask(item);
	if (kind === 'hard' || isExplicitlyHard(item)) return 'hard';
	if (isHarnessModule(item)) return 'module-job';
	const light = !floorReasons(item).length && isLightClaudeWork(item, kind, sizeOf(item));
	return light ? 'simple' : 'default';
}
