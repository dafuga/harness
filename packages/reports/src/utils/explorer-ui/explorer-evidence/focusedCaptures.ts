import type { ExplorerCapture, ExplorerSide } from '../../../models/Explorer.types';
import type { HarnessRevision, HarnessScenario } from '../../../models/Harness.types';

/** @pure Select stored, source-bound focused images of exactly this unit and commit. */
export function focusedCaptures(detail: HarnessRevision, unit: string): ExplorerCapture[] {
	const points = (detail.regressions ?? [])
		.flatMap((run) =>
			[run.green, run.red]
				.filter((point) => point?.commit === detail.commit)
				.map((point) => ({ loop: run.loop, point: point! }))
		)
		.sort((a, b) => b.point.finishedAt.localeCompare(a.point.finishedAt));
	const found = points.flatMap(({ loop, point }) =>
		(point.captures ?? []).flatMap((item): ExplorerCapture[] => {
			const capture = item.capture;
			if (
				item.unit !== unit ||
				capture.kind !== 'screenshot' ||
				capture.status !== 'passed' ||
				!capture.media ||
				capture.provenance !== 'actual-capture' ||
				capture.server?.revision !== detail.commit ||
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
					current: true,
					inheritedFrom: null,
					focused: { loop, status: point.status, record: point.id ?? '', viewport: item.viewport }
				}
			];
		})
	);
	return found.filter(
		(item, index) =>
			found.findIndex(
				(other) => other.state === item.state && other.capture.viewport === item.capture.viewport
			) === index
	);
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
