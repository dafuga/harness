// @harness-uid u_t54qlfjow6
import type { ContractEntry, ContractMap, ContractMatch, ContractSummary } from './contracts.types';

/** Text preserves every stored contract field; compact commands print one row per match. */
export function renderContracts(
	operation: string,
	result: ContractMap | ContractSummary[]
): string {
	if (operation === 'map') return renderMap(result as ContractMap);
	const rows = result as ContractSummary[];
	if (operation === 'show') return (rows as ContractEntry[]).map(renderEntry).join('\n\n');
	return rows
		.map((row) => {
			const match = row as ContractMatch;
			const description =
				operation === 'search' ? `${match.field}: ${match.snippet}` : short(row.responsibility);
			return `${row.id}  ${row.path}  ${description}`;
		})
		.join('\n');
}

function renderEntry(entry: ContractEntry): string {
	const { manifest } = entry;
	return [
		`# ${entry.id} (${entry.kind}, ${manifest.status})`,
		entry.responsibility,
		`Source: ${manifest.owns.source.join(', ')}`,
		`Stored contract: ${entry.contractPath}`,
		...renderFields(manifest.contract, 'Contract'),
		...renderFields(manifest.helperContracts, 'Helper contracts'),
		...renderFields(manifest.dependencies, 'Dependencies'),
		...renderFields(manifest.scenarios, 'States / scenarios'),
		...renderFields(entry.states, 'Declared states')
	].join('\n');
}

function renderFields(data: unknown, label: string, depth = 0): string[] {
	const indent = '  '.repeat(depth);
	if (data === undefined) return [];
	if (data === null || typeof data !== 'object') return [`${indent}${label}: ${String(data)}`];
	const entries = Object.entries(data);
	return [
		`${indent}${label}${entries.length ? ':' : ': none'}`,
		...entries.flatMap(([key, value]) => renderFields(value, key, depth + 1))
	];
}

function renderMap(result: ContractMap): string {
	return (['matches', 'dependencies', 'dependents'] as const)
		.flatMap((section) => [
			`${section}:`,
			...result[section].map((row) => `  ${row.id}  ${row.path}  ${short(row.responsibility)}`)
		])
		.concat(result.unresolved.map((id) => `unresolved: ${id}`))
		.join('\n');
}

function short(text: string): string {
	const line = text.replace(/\s+/g, ' ');
	return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}
