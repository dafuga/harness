// @harness-uid u_hstrendabc
import type {
	ContractChange,
	ContractChangeSummary,
	ContractDiff,
	ContractFieldChange,
	ContractLog
} from './contractHistory.types';

export function renderContractDiff(diff: ContractDiff, summary = false): string {
	return [
		`Comparing ${diff.base} -> ${diff.head}`,
		renderSummary(diff.summary),
		...diff.changes.flatMap((change) => renderChange(change, summary)),
		...(diff.truncated
			? [`Showing ${diff.changes.length} of ${diff.total} contracts (--limit).`]
			: [])
	].join('\n');
}

export function renderContractLog(log: ContractLog, summary = false): string {
	return [
		log.identityScope,
		...log.entries.flatMap((entry) => [
			'',
			`${entry.commit}  ${entry.date}  ${entry.author.name} <${entry.author.email}>`,
			entry.subject,
			renderSummary(entry.summary),
			...entry.changes.flatMap((change) => renderChange(change, summary))
		]),
		...(log.truncated
			? [
					`History limited after ${log.scannedCommits} candidate commits; raise --limit to continue.`
				]
			: [])
	].join('\n');
}

function renderSummary(summary: ContractChangeSummary): string {
	return `${summary.contracts} contracts: ${summary.added} added, ${summary.removed} removed, ${summary.moved} moved, ${summary.changed} changed; ${summary.fields} fields. Ignored: ${summary.formattingOnlyFiles} formatting-only files, ${summary.reorderedOnlyFiles} metadata-reorder-only files.`;
}

function renderChange(change: ContractChange, summary: boolean): string[] {
	const sign = changeSign(change.kind);
	const previous = change.previousId ? `${change.previousId} -> ` : '';
	return [
		paint(`${sign} ${previous}${change.id} (${change.kind}, ${change.fields.length} fields)`, sign),
		...wrap(
			`  ${change.previousContractPath ? `${change.previousContractPath} -> ` : ''}${change.contractPath}`
		),
		...wrap(`  Source: ${change.sourcePaths.join(', ') || '(not recorded)'}`),
		...(summary ? [] : change.fields.flatMap(renderField))
	];
}

function renderField(field: ContractFieldChange): string[] {
	const sign = changeSign(field.kind);
	const text = fieldText(field);
	return wrap(`  ${sign} ${field.path}: ${text}`).map((line) => paint(line, sign));
}

function changeSign(kind: string): string {
	if (kind === 'added') return '+';
	return kind === 'removed' ? '-' : '~';
}

function fieldText(field: ContractFieldChange): string {
	if (field.kind === 'added') return printable(field.after);
	if (field.kind === 'removed') return printable(field.before);
	return `${printable(field.before)} -> ${printable(field.after)}`;
}

function printable(data: unknown): string {
	return JSON.stringify(data) ?? '(missing)';
}

function wrap(text: string): string[] {
	const width = Math.max(40, Math.min(process.stdout.columns || 100, 140));
	const lines: string[] = [];
	let remaining = text;
	while (remaining.length > width) {
		const space = remaining.lastIndexOf(' ', width);
		const end = space > width / 2 ? space : width;
		lines.push(remaining.slice(0, end));
		remaining = `    ${remaining.slice(end).trimStart()}`;
	}
	return [...lines, remaining];
}

function paint(text: string, sign: string): string {
	if (process.env.NO_COLOR !== undefined || !(process.stdout.isTTY || process.env.FORCE_COLOR))
		return text;
	const colors: Record<string, number> = { '+': 32, '-': 31, '~': 33 };
	return `\u001b[${colors[sign] ?? 33}m${text}\u001b[0m`;
}
