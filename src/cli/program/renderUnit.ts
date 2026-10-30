import type { UnitDetail } from './inspectUnits.types';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import { indent } from './contractRows';
import { renderContract } from './renderContract';
export { renderContract } from './renderContract';

/** Test files grouped by directory, each with its count, so a long list stays one screen. */
export function groupTests(tests: string[]): string[] {
	if (tests.length === 0) return ['none'];
	const groups = new Map<string, number>();
	for (const test of tests) {
		const directory = test.includes('/') ? test.slice(0, test.lastIndexOf('/') + 1) : './';
		groups.set(directory, (groups.get(directory) ?? 0) + 1);
	}
	const width = Math.max(...[...groups.keys()].map((directory) => directory.length));
	return [
		`${tests.length} files`,
		...[...groups].map(([directory, count]) => `  ${directory.padEnd(width)}  ${count}`)
	];
}

/** Secondary facts as `Label  value` rows; a multi-value row continues under its value. */
function details(rows: Array<[string, string[]]>): string[] {
	const width = Math.max(...rows.map(([label]) => label.length));
	return rows.flatMap(([label, values]) => {
		const [first = 'none', ...rest] = values;
		return [`${label.padEnd(width)}  ${first}`, ...rest.map((v) => `${' '.repeat(width)}  ${v}`)];
	});
}

function runtimeRows(manifest: ComponentManifest): Array<[string, string[]]> {
	const { runtime } = manifest;
	const main = `${runtime.kind} ${runtime.entry}`;
	const targets = runtime.targets.map((target) => `${target.kind} ${target.entry}`);
	const extra = targets.length === 1 && targets[0] === main ? [] : targets;
	return [['Runtime', [main]], ...(extra.length ? [['Targets', extra] as [string, string[]]] : [])];
}

export function renderUnit(detail: UnitDetail): string {
	const { manifest, version } = detail;
	const retired = manifest.lineage?.predecessors ?? [];
	const rows: Array<[string, string[]]> = [
		['Source', manifest.owns.source],
		...(detail.declarations
			? [
					[
						'Declarations',
						detail.declarations.map((item) => `${item.name}: ${item.role} (${item.source})`)
					] as [string, string[]]
				]
			: []),
		...runtimeRows(manifest),
		[
			'Version',
			[`source ${version.source.slice(0, 12)} · contract ${version.contract.slice(0, 12)}`]
		],
		...(retired.length ? [['Continues', retired] as [string, string[]]] : []),
		['Depends on', manifest.dependencies.map((d) => `${d.unit} (${d.via})`)],
		['Consumers', detail.consumers],
		['Impacted test files', groupTests(detail.tests)],
		...(detail.testAttribution
			? ([
					[
						'Direct import files',
						groupTests(detail.testAttribution.directImports.map((test) => test.file))
					],
					[
						'Transitive impact files',
						groupTests(detail.testAttribution.transitiveImpacts.map((test) => test.file))
					],
					['Authored scenarios', detail.testAttribution.scenarios.map((scenario) => scenario.id)]
				] as Array<[string, string[]]>)
			: []),
		['Scenarios', manifest.scenarios]
	];
	return [
		`# ${manifest.id}  (${manifest.kind}, ${manifest.status})`,
		manifest.responsibility,
		'',
		...renderContract(manifest),
		'',
		'Details',
		...indent(details(rows))
	].join('\n');
}
