import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ExportPlan {
	source: string;
	named?: string[];
	types?: string[];
}

export async function applyExports(root: string, plans: ExportPlan[]): Promise<boolean> {
	if (plans.length === 0) {
		return false;
	}

	const target = join(root, 'src/index.ts');
	const current = await readFile(target, 'utf8');
	const next = appendMissingExports(current, plans);

	if (next === current) {
		return false;
	}

	await writeFile(target, next);
	return true;
}

export function appendMissingExports(contents: string, plans: ExportPlan[]): string {
	const lines = plans.flatMap(exportLines);
	const additions = lines.filter((line) => !contents.includes(line));

	if (additions.length === 0) {
		return contents;
	}

	const separator = contents.length === 0 || contents.endsWith('\n') ? '' : '\n';
	return `${contents}${separator}${additions.join('\n')}\n`;
}

function exportLines(plan: ExportPlan): string[] {
	const lines: string[] = [];

	if (plan.named?.length) {
		lines.push(`export { ${plan.named.join(', ')} } from '${plan.source}';`);
	}

	if (plan.types?.length) {
		lines.push(`export type { ${plan.types.join(', ')} } from '${plan.source}';`);
	}

	return lines;
}
