// @harness-uid u_dxfhj3khjo
import type {
	HealthUnit,
	ScenarioHealth,
	ScenarioHealthInput,
	ViewportSize
} from './scenarioHealth.types';
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

/** The viewport ids the documentation promises. */
export const documentedViewports = ['desktop', 'tablet', 'mobile'];

/**
 * Canonical viewport presets (V-04 decision: canonical presets, warn-only for one release).
 * Sizes are the most used size of each id across the scenario set.
 */
export const canonicalViewports: Record<string, { width: number; height: number }> = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 920, height: 800 },
	mobile: { width: 390, height: 844 }
};

/** Documented aliases: older ids that mean a canonical preset. */
export const viewportAliases: Record<string, string> = {
	phone: 'mobile',
	'nav-phone': 'mobile',
	'agent-phone': 'mobile',
	'nav-tablet': 'tablet',
	'agents-tablet': 'tablet'
};

const byText = (left: string, right: string) => {
	if (left === right) return 0;
	return left < right ? -1 : 1;
};

/**
 * What a reader needs to know about the scenario set without changing it: viewport ids and
 * sizes that drift, how states are covered, and which active units no scenario covers.
 * Nothing here is an error; the contracts themselves are judged elsewhere.
 */
export function scenarioHealth(input: ScenarioHealthInput): ScenarioHealth {
	const { scenarios, units } = input;
	return {
		scenarios: scenarios.length,
		viewports: viewportReport(scenarios),
		coverage: coverageCounts(scenarios),
		noScenario: noScenarioReport(scenarios, units)
	};
}

function viewportReport(scenarios: ScenarioManifest[]): ScenarioHealth['viewports'] {
	const sizes = new Map<string, Map<string, ViewportSize>>();
	for (const scenario of scenarios) {
		for (const viewport of scenario.viewports) {
			const bySize = sizes.get(viewport.id) ?? new Map<string, ViewportSize>();
			const key = `${viewport.width}x${viewport.height}@${viewport.scale ?? 1}`;
			const used = bySize.get(key) ?? {
				width: viewport.width,
				height: viewport.height,
				...(viewport.scale === undefined ? {} : { scale: viewport.scale }),
				scenarios: []
			};
			used.scenarios.push(scenario.id);
			bySize.set(key, used);
			sizes.set(viewport.id, bySize);
		}
	}
	const ids = [...sizes.keys()].sort(byText);
	const scenariosOf = (id: string) =>
		[...new Set([...sizes.get(id)!.values()].flatMap((size) => size.scenarios))].sort(byText);
	return {
		known: documentedViewports,
		unknown: ids
			.filter((id) => !documentedViewports.includes(id))
			.map((id) => ({ id, scenarios: scenariosOf(id), canonical: viewportAliases[id] ?? null })),
		conflicts: ids
			.filter((id) => sizes.get(id)!.size > 1)
			.map((id) => ({ id, sizes: orderedSizes([...sizes.get(id)!.values()]) })),
		offPreset: offPresetReport(scenarios)
	};
}

/** Every scenario viewport whose size differs from its canonical preset (after aliases). */
function offPresetReport(scenarios: ScenarioManifest[]): ScenarioHealth['viewports']['offPreset'] {
	const rows: ScenarioHealth['viewports']['offPreset'] = [];
	for (const scenario of scenarios) {
		for (const viewport of scenario.viewports) {
			const canonical = documentedViewports.includes(viewport.id)
				? viewport.id
				: viewportAliases[viewport.id];
			const preset = canonical ? canonicalViewports[canonical] : undefined;
			if (!preset || (preset.width === viewport.width && preset.height === viewport.height))
				continue;
			rows.push({
				scenario: scenario.id,
				id: viewport.id,
				canonical,
				size: `${viewport.width}x${viewport.height}`,
				preset: `${preset.width}x${preset.height}`
			});
		}
	}
	return rows.sort((a, b) => byText(a.scenario, b.scenario) || byText(a.id, b.id));
}

function orderedSizes(sizes: ViewportSize[]): ViewportSize[] {
	return sizes
		.map((size) => ({ ...size, scenarios: [...size.scenarios].sort(byText) }))
		.sort((left, right) => left.width - right.width || left.height - right.height);
}

function coverageCounts(scenarios: ScenarioManifest[]): ScenarioHealth['coverage'] {
	const counts = { required: 0, missing: 0, inapplicable: 0 };
	for (const scenario of scenarios) {
		for (const state of scenario.states) counts[state.coverage] += 1;
	}
	return counts;
}

function noScenarioReport(
	scenarios: ScenarioManifest[],
	units: HealthUnit[]
): ScenarioHealth['noScenario'] {
	const covered = new Set(scenarios.flatMap((scenario) => scenario.units));
	const retired = units.filter((unit) => unit.status === 'retired' && !covered.has(unit.id));
	const uncovered = units.filter((unit) => unit.status === 'active' && !covered.has(unit.id));
	const ids = (kind: (unit: HealthUnit) => boolean) =>
		uncovered
			.filter(kind)
			.map((unit) => unit.id)
			.sort(byText);
	const components = ids((unit) => unit.kind === 'component');
	const pages = ids((unit) => unit.kind === 'page');
	const other = ids((unit) => unit.kind !== 'component' && unit.kind !== 'page');
	const byPrefix: Record<string, number> = {};
	for (const unit of uncovered.filter(({ kind }) => kind === 'component' || kind === 'page')) {
		const prefix = prefixOf(unit);
		byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;
	}
	return {
		total: uncovered.length,
		retired: retired.length,
		counts: { components: components.length, pages: pages.length, other: other.length },
		components,
		pages,
		other,
		byPrefix: Object.fromEntries(Object.entries(byPrefix).sort(([a], [b]) => byText(a, b)))
	};
}

function presetText(): string {
	return Object.entries(canonicalViewports)
		.map(([id, size]) => `${id} ${size.width}x${size.height}`)
		.join(', ');
}

/** `reports.component` for `reports.component.select`: the package and the kind of the unit. */
function prefixOf(unit: HealthUnit): string {
	const [first, second] = unit.id.split('.');
	return second === unit.kind ? `${first}.${second}` : unit.kind;
}

/** The report as lines a person reads; the unit ids themselves are only in `--json`. */
export function renderScenarioHealth(health: ScenarioHealth): string[] {
	const { viewports, noScenario, coverage } = health;
	const sized = (size: ViewportSize) =>
		`${size.width}x${size.height}${size.scale ? `@${size.scale}` : ''} (${size.scenarios.join(', ')})`;
	return [
		`Report only, nothing here changes the result of this check:`,
		`Viewport ids outside ${viewports.known.join('|')}: ${viewports.unknown.length}`,
		...viewports.unknown.map(
			(item) =>
				`  ${item.id}${item.canonical ? ` (alias of ${item.canonical})` : ''}: ${item.scenarios.join(', ')}`
		),
		`Warning (canonical presets ${presetText()}): ${viewports.offPreset.length} scenario viewports use another size.`,
		`Viewport ids used at more than one size: ${viewports.conflicts.length}`,
		...viewports.conflicts.map((item) => `  ${item.id}: ${item.sizes.map(sized).join('; ')}`),
		`State coverage: ${coverage.required} required, ${coverage.missing} missing, ${coverage.inapplicable} inapplicable (field \`coverage\` of each state).`,
		`Active units in no scenario: ${noScenario.total} ` +
			`(components ${noScenario.counts.components}, pages ${noScenario.counts.pages}, ` +
			`other ${noScenario.counts.other}); retired units outside any scenario: ${noScenario.retired}.`,
		...Object.entries(noScenario.byPrefix).map(([prefix, count]) => `  ${prefix}: ${count}`),
		'Run `harness scenarios check --json` for the unit ids.'
	];
}
