import type { ModuleValidationInput } from '../ModuleDataValidator.types';
import type { ModuleIssue } from '../../../services/git-source-history/ModuleDataService.types';
import type { Unit } from './moduleFields.types';
import { explorerCategory } from '../../../../packages/reports/src/utils/explorer-ui/explorerCategory';

export function moduleEvidence(
	detail: ModuleValidationInput,
	unit: Unit,
	tree?: string
): ModuleIssue[] {
	const records = detail.records.filter(
		(record) => record.valid && record.source.commit === detail.commit
	);
	const focused =
		detail.regressions?.flatMap((proof) =>
			!proof.gap &&
			proof.green?.status === 'passed' &&
			(proof.green.commit === detail.commit || (Boolean(tree) && proof.green.sourceTree === tree))
				? [proof.green]
				: []
		) ?? [];
	const measurements = records
		.flatMap((record) => record.measurements)
		.filter((item) => item.unit === unit.id)
		.concat(
			focused.flatMap((point) => point.measurements ?? []).filter((item) => item.unit === unit.id)
		);

	const issues: ModuleIssue[] = unit.budgets.performance.flatMap((required) => {
		const found = measurements.some(
			(item) =>
				item.value !== null &&
				!item.partial &&
				item.metric === required.metric &&
				item.workload === required.workload &&
				(!required.target || item.target === required.target)
		);
		return found
			? []
			: [
					{
						field: `measurements.${required.workload}.${required.metric}`,
						message: 'Missing required workload observation.',
						repair: 'Run and attach the declared workload for this revision, target and profile.'
					}
				];
	});

	return [...issues, ...moduleScreenshots(detail, unit, tree)];
}
function moduleScreenshots(
	detail: ModuleValidationInput,
	unit: Unit,
	tree?: string
): ModuleIssue[] {
	if (!visualModule(unit)) return [];
	const issues: ModuleIssue[] = [];
	if (!unit.preview)
		issues.push({
			field: 'preview',
			message: 'Missing dedicated visual scenario/state.',
			repair: 'Declare the module preview and required viewports.'
		});
	for (const id of unit.scenarios) {
		const scenario = detail.registry.scenarios.find((item) => item.id === id);
		if (!scenario) {
			issues.push({
				field: 'scenarios',
				message: `Unknown scenario ${id}.`,
				repair: 'Commit its scenario manifest.'
			});
			continue;
		}
		const slots = scenario.evidence
			.filter((item) => item.kind === 'screenshot' && item.required !== false)
			.flatMap((evidence) =>
				evidence.states.flatMap((state) =>
					evidence.viewports.map((viewport) => ({ evidence: evidence.id, state, viewport }))
				)
			);
		for (const slot of slots) {
			const declared = scenario.states.find((item) => item.id === slot.state);
			if (!(declared?.units ?? scenario.units).includes(unit.id)) continue;
			if (
				![hasScreenshot(detail, id, slot), hasFocusedScreenshot(detail, unit.id, slot, tree)].some(
					Boolean
				)
			)
				issues.push({
					field: `screenshots.${id}.${slot.state}.${slot.viewport}`,
					message: 'Missing intact revision-bound screenshot.',
					repair: 'Run the declared capture scenario and attach the original image bytes.'
				});
		}
	}
	return issues;
}
function hasScreenshot(
	detail: ModuleValidationInput,
	scenario: string,
	slot: { evidence: string; state: string; viewport: string }
): boolean {
	return detail.records
		.filter((record) => record.valid && record.source.commit === detail.commit)
		.some((record) =>
			record.scenarios.some(
				(ran) =>
					ran.id === scenario &&
					(ran.testedRevision === detail.commit || ran.status === 'referenced') &&
					ran.states.some(
						(shown) =>
							shown.id === slot.state &&
							shown.captures.some(
								(capture) =>
									capture.evidence === slot.evidence &&
									capture.viewport === slot.viewport &&
									capture.status === 'passed' &&
									!capture.gap
							)
					)
			)
		);
}

function visualModule(unit: Unit) {
	return ['pages', 'layouts', 'components'].includes(explorerCategory(unit) ?? '');
}

function hasFocusedScreenshot(
	detail: ModuleValidationInput,
	unit: string,
	slot: { evidence: string; state: string; viewport: string },
	tree?: string
) {
	return (
		detail.regressions?.some((proof) => {
			const point = proof.green;
			if (proof.gap || point?.status !== 'passed') return false;
			if (point.commit !== detail.commit && (!tree || point.sourceTree !== tree)) return false;
			return (
				point.captures?.some(
					(item) =>
						item.unit === unit &&
						item.capture.evidence === slot.evidence &&
						item.capture.state === slot.state &&
						item.capture.viewport === slot.viewport &&
						item.capture.status === 'passed' &&
						!item.capture.gap &&
						item.capture.media !== null
				) ?? false
			);
		}) ?? false
	);
}
