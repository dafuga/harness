import type { ExplorerCapture, ExplorerSide } from '../../../models/Explorer.types';
import type {
	HarnessCapture,
	HarnessRevision,
	HarnessScenario
} from '../../../models/Harness.types';

/** @pure Select revision-bound images and class audio without granting a full verification verdict. */
export function focusedCaptures(detail: HarnessRevision, unit: string): ExplorerCapture[] {
	const audio = new Map<ExplorerCapture, string>();
	const points = focusedPoints(detail);
	const found = points.flatMap(({ loop, point }) => {
		const origin = {
			current: point.commit === detail.commit,
			inheritedFrom: point.commit === detail.commit ? null : point.commit
		};
		return (point.captures ?? []).flatMap((item): ExplorerCapture[] => {
			const capture = item.capture;
			if (item.unit !== unit) return [];
			const kind = capture.kind;
			const caseId = kind === 'audio' ? audioCase(capture, point.commit, unit) : null;
			if (kind === 'audio' ? !caseId : !validScreenshot(capture, kind, point.commit)) return [];
			const selected: ExplorerCapture = {
				scenario: 'focused',
				state: capture.state,
				capture,
				standing: 'unvalidated',
				usable: true,
				...origin,
				focused: { loop, status: point.status, record: point.id ?? '', viewport: item.viewport }
			};
			if (caseId) audio.set(selected, JSON.stringify([caseId, capture.evidence, capture.state]));
			return [selected];
		});
	});
	return projectedCaptures(found, audio);
}

/** @pure The logical capture state supplied by the producer, independent of its storage path. */
export function withoutViewportSuffix(state: string, viewport: string): string {
	const suffix = `-${viewport}`;
	return viewport && state.endsWith(suffix) ? state.slice(0, -suffix.length) : state;
}

/** Preserve original capture metadata while grouping compatible device-qualified display states. */
function projectedCaptures(
	captures: ExplorerCapture[],
	audio: Map<ExplorerCapture, string>
): ExplorerCapture[] {
	const images = audio.size ? captures.filter((item) => !audio.has(item)) : captures;
	const keys = new Map<ExplorerCapture, string>();
	const found = captures.map((item) => {
		const key = audio.get(item);
		const projected = { ...item, state: key ? item.state : sharedState(item, images) };
		if (key) keys.set(projected, key);
		return projected;
	});
	return found.filter(
		(item, index) =>
			found.findIndex((other) => {
				const key = keys.get(item),
					otherKey = keys.get(other);
				return key
					? key === otherKey
					: !otherKey &&
							other.state === item.state &&
							other.capture.viewport === item.capture.viewport;
			}) === index
	);
}

function sharedState(item: ExplorerCapture, captures: ExplorerCapture[]): string {
	const viewport = item.capture.viewport ?? '';
	const state = withoutViewportSuffix(item.state, viewport);
	if (state === item.state) return state;
	const sibling = captures.some(
		(other) =>
			other.capture.viewport !== viewport &&
			other.focused?.record === item.focused?.record &&
			other.capture.server?.revision === item.capture.server?.revision &&
			withoutViewportSuffix(other.state, other.capture.viewport ?? '') === state
	);
	return sibling ? state : item.state;
}

/** @pure Describe a focused gallery independently of declared full-verification scenarios. */
export function focusedScenario(
	sides: Array<ExplorerSide | null>,
	unit: string
): HarnessScenario[] {
	const captures = sides.flatMap(
		(side) =>
			side?.captures.filter((item) => item.focused && item.capture.kind === 'screenshot') ?? []
	);
	if (!captures.length) return [];
	const states = [...new Set(captures.map((item) => item.state))];
	const viewports = [
		...new Set(captures.map((item) => item.capture.viewport).filter((id) => id !== undefined))
	];
	const declared = sides.flatMap(
		(side) =>
			side?.detail?.registry.scenarios
				.filter((scenario) => scenario.units.includes(unit))
				.flatMap((scenario) => scenario.viewports) ?? []
	);
	const fallback: Record<string, [number, number]> = {
		desktop: [1440, 900],
		tablet: [920, 800],
		mobile: [390, 844]
	};
	return [
		{
			id: 'focused',
			title: 'Focused screenshots',
			kind: 'focused',
			units: [unit],
			tests: [],
			states: states.map((id) => ({ id, coverage: 'required' })),
			viewports: viewports.map((id) => {
				const size = captures.find((item) => item.capture.viewport === id)?.focused?.viewport;
				const viewport = declared.find(
					(item) => item.id === id && (!size || item.width === size.width)
				);
				const [width, height] = size ? [size.width, size.height] : (fallback[id] ?? [0, 0]);
				return { id, width: viewport?.width ?? width, height: viewport?.height ?? height };
			})
		}
	];
}

function focusedPoints(detail: HarnessRevision) {
	return (detail.regressions ?? [])
		.flatMap((run) =>
			[run.green, run.red]
				.filter(
					(point) =>
						point &&
						(point.commit === detail.commit ||
							(point.sourceTree &&
								(detail.sourceTree === point.sourceTree ||
									detail.side === `sides/${point.sourceTree}.json`)))
				)
				.map((point) => ({ loop: run.loop, point: point! }))
		)
		.sort((a, b) => b.point.finishedAt.localeCompare(a.point.finishedAt));
}

function validAudio(capture: HarnessCapture): boolean {
	return [
		capture.status === 'passed',
		typeof capture.media === 'string' && capture.media.trim().length > 0,
		['fixture', 'actual-capture'].includes(capture.provenance ?? ''),
		capture.viewport === undefined,
		typeof capture.transcript === 'string' && capture.transcript.trim().length > 0,
		typeof capture.mediaType === 'string' && capture.mediaType.startsWith('audio/'),
		typeof capture.bytes === 'number' && Number.isFinite(capture.bytes) && capture.bytes > 0,
		capture.durationSeconds === undefined ||
			(Number.isFinite(capture.durationSeconds) && capture.durationSeconds > 0),
		/^[a-f0-9]{64}$/.test(capture.sha256)
	].every(Boolean);
}

function audioCase(capture: HarnessCapture, revision: string, unit: string): string | null {
	if (!validAudio(capture)) return null;
	try {
		const parsed: unknown = JSON.parse(capture.note ?? 'null');
		if (![!!parsed, typeof parsed === 'object', !Array.isArray(parsed)].every(Boolean)) return null;
		const binding = parsed as Record<string, unknown>;
		if (Object.keys(binding).sort().join(',') !== 'case,revision,sha256,unit') return null;
		if (
			![
				binding.unit === unit,
				binding.revision === revision,
				binding.sha256 === capture.sha256
			].every(Boolean)
		)
			return null;
		return typeof binding.case === 'string' && binding.case.trim() ? binding.case : null;
	} catch {
		return null;
	}
}

function validScreenshot(capture: HarnessCapture, kind: string, revision: string): boolean {
	return (
		kind === 'screenshot' &&
		capture.status === 'passed' &&
		!!capture.media &&
		capture.provenance === 'actual-capture' &&
		capture.server?.revision === revision &&
		!!capture.server.buildId
	);
}
