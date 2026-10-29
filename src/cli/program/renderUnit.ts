import type { UnitDetail } from './inspectUnits.types';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

type Field = ComponentManifest['contract']['inputs'][number];
const indent = (lines: string[], depth = 1) => lines.map((line) => `${'  '.repeat(depth)}${line}`);

function qualifiers(item: Field): string {
	const values = [
		item.required === undefined ? undefined : item.required ? 'required' : 'optional',
		Object.hasOwn(item, 'default') ? `default ${JSON.stringify(item.default)}` : undefined
	].filter((value): value is string => Boolean(value));
	return values.length ? `  (${values.join('; ')})` : '';
}

/** `name  type` rows with the types in one column; the owner prefix (`Badge.`) is dropped. */
function fields(list: Field[]): string[] {
	if (list.length === 0) return ['none'];
	const shortNames = list.map((item) => item.name.split('.').at(-1) ?? item.name);
	const repeated = new Set(shortNames.filter((name, index) => shortNames.indexOf(name) !== index));
	const rows = list.map(
		(item, index) =>
			[
				repeated.has(shortNames[index]) ? item.name : shortNames[index],
				`${item.type}${qualifiers(item)}`
			] as const
	);
	const width = Math.max(...rows.map(([name]) => name.length));
	return rows.map(([name, type]) => (type === 'thrown' ? name : `${name.padEnd(width)}  ${type}`));
}

/** What a caller needs: props or inputs, outputs for anything but a component, and errors. */
export function renderContract(manifest: ComponentManifest): string[] {
	const { contract, kind } = manifest;
	const component = kind === 'component';
	if (
		!component &&
		(contract.operations?.length || contract.initialization?.length || contract.storage?.length)
	)
		return [
			`Contract (${contract.origin})`,
			...(contract.storage?.length
				? ['  Storage', ...indent(storageRows(contract.storage), 2)]
				: []),
			...(contract.initialization?.length
				? ['  Initialization', ...indent(operationRows(contract.initialization), 2)]
				: []),
			...(contract.operations?.length
				? ['  Operations', ...indent(operationRows(contract.operations), 2)]
				: [])
		];
	const sections: Array<[string, Field[]]> = [
		[component ? 'Props' : 'Inputs', contract.inputs],
		...(component ? [] : ([['Outputs', contract.outputs]] as Array<[string, Field[]]>)),
		['Errors', contract.errors]
	];
	return [
		`Contract (${contract.origin})`,
		...indent(
			sections.flatMap(([title, list]) => [
				title,
				...indent(
					title === 'Errors' && !list.length && contract.origin === 'derived'
						? ['none found (static analysis; indirect errors unknown)']
						: fields(list)
				)
			])
		),
		...(contract.snippets?.length
			? ['  Snippets (local)', ...indent(operationRows(contract.snippets), 2)]
			: []),
		...(component && contract.operations?.length
			? ['  Module exports', ...indent(operationRows(contract.operations), 2)]
			: [])
	];
}

function operationRows(
	operations: NonNullable<ComponentManifest['contract']['operations']>
): string[] {
	return operations.flatMap((operation) => [
		operation.name,
		...indent([
			'Inputs',
			...indent(fields(operation.inputs)),
			'Outputs',
			...indent(fields(operation.outputs)),
			'Errors',
			...indent(
				operation.errors.length
					? fields(operation.errors)
					: [
							operation.errorStatus === 'declared'
								? 'none (declared)'
								: operation.errorStatus === 'unknown'
									? 'unknown (indirect calls or dynamic throws)'
									: 'none found (static analysis; indirect errors unknown)'
						]
			)
		])
	]);
}

function storageRows(models: NonNullable<ComponentManifest['contract']['storage']>): string[] {
	return models.flatMap((model) => [
		model.name,
		...indent([
			`Table  ${model.table ?? 'unknown'}`,
			`Primary key  ${model.primaryKey ?? 'unknown'}`,
			...model.fields.map(
				(field) =>
					`${field.name}  ${field.type}${qualifiers(field)}${field.primaryKey ? '  (primary key)' : ''}${field.nullable ? '  (nullable)' : ''}${field.validation ? `  validation: ${field.validation}` : ''}${field.relations ? `  relations: ${field.relations}` : ''}`
			),
			...(model.validation ? [`Validation  ${model.validation}`] : []),
			...(model.relations ? [`Relations  ${model.relations}`] : []),
			...(model.unresolved ?? []).map((gap) => `Unresolved  ${gap}`)
		])
	]);
}

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
		...runtimeRows(manifest),
		[
			'Version',
			[`source ${version.source.slice(0, 12)} · contract ${version.contract.slice(0, 12)}`]
		],
		...(retired.length ? [['Continues', retired] as [string, string[]]] : []),
		['Depends on', manifest.dependencies.map((d) => `${d.unit} (${d.via})`)],
		['Consumers', detail.consumers],
		['Tests', groupTests(detail.tests)],
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
