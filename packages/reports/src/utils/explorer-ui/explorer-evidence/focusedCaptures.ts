import type { ExplorerCapture, ExplorerSide } from '../../../models/Explorer.types';
import type { HarnessRevision, HarnessScenario } from '../../../models/Harness.types';

/** @pure Select this unit's stored images from the same commit or an identical whole source tree. */
export function focusedCaptures(detail: HarnessRevision, unit: string): ExplorerCapture[] {
	const points = (detail.regressions ?? [])
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
	const found = points.flatMap(({ loop, point }) => {
		const origin = {
			current: point.commit === detail.commit,
			inheritedFrom: point.commit === detail.commit ? null : point.commit
		};
		return (point.captures ?? []).flatMap((item): ExplorerCapture[] => {
			const capture = item.capture;
			if (
				item.unit !== unit ||
				capture.kind !== 'screenshot' ||
				capture.status !== 'passed' ||
				!capture.media ||
				capture.provenance !== 'actual-capture' ||
				capture.server?.revision !== point.commit ||
				!capture.server.buildId
			)
				return [];
			return [
				{
					scenario: 'focused',
					state: capture.state,
					capture,
					standing: 'unvalidated',
					usable: true,
					...origin,
					focused: { loop, status: point.status, record: point.id ?? '', viewport: item.viewport }
				}
			];
		});
	});
	return projectedCaptures(found);
}

/** @pure The logical capture state supplied by the producer, independent of its storage path. */
export function withoutViewportSuffix(state: string, _viewport: string): string {
	return state;
}

/** Preserve original capture metadata while grouping compatible device-qualified display states. */
function projectedCaptures(captures: ExplorerCapture[]): ExplorerCapture[] {
	const found = captures.map((item) => ({ ...item, state: sharedState(item, captures) }));
	return found.filter(
		(item, index) =>
			found.findIndex(
				(other) => other.state === item.state && other.capture.viewport === item.capture.viewport
			) === index
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
	const captures = sides.flatMap((side) => side?.captures.filter((item) => item.focused) ?? []);
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
