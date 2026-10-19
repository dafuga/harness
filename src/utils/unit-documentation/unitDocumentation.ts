import { z } from "zod";
import type { SourceTree } from "../../core/sourceTypes";

const example = z
	.strictObject({
		name: z.string().trim().min(1).max(160),
		description: z.string().max(500).optional(),
		input: z.json(),
		output: z.json().optional(),
		error: z.json().optional()
	})
	.refine((value) => Object.hasOwn(value, 'output') !== Object.hasOwn(value, 'error'));

const document = z.strictObject({
	schemaVersion: z.literal(1),
	unitId: z.string(),
	examples: z.array(example).min(1).max(64)
});

export interface UsageExample {
	name: string;
	description?: string;
	input: unknown;
	output?: unknown;
	error?: unknown;
}

export interface UnitDocumentation {
	path: string;
	/** Original Markdown, retained verbatim for review; never rendered as HTML. */
	text?: string;
	examples: UsageExample[];
	gap?: string;
}

/** Authored uses are expected behavior, never observed test results. */
export function unitDocumentation(text: string, unitId: string, path = ''): UnitDocumentation {
	const gap = (reason: string): UnitDocumentation => ({ path, text, examples: [], gap: reason });
	if (text.length > 262_144) return gap('The documentation exceeds the 256 KB limit.');
	const blocks = [...text.matchAll(/^```harness-examples\s*\n([\s\S]*?)^```\s*$/gm)];
	if (blocks.length !== 1) return gap('The document needs one harness-examples block.');
	try {
		const read = document.safeParse(JSON.parse(blocks[0][1]));
		if (!read.success) return gap('The documented examples are malformed.');
		if (read.data.unitId !== unitId) return gap('The document belongs to another entity.');
		return { path, text, examples: read.data.examples };
	} catch {
		return gap('The documented examples are not valid JSON.');
	}
}

/** No working-tree fallback: a missing historical document stays missing. */
export async function readUnitDocumentation(
	tree: Pick<SourceTree, 'read'>,
	unit: { id: string; documentation?: string }
): Promise<UnitDocumentation | undefined> {
	const path = unit.documentation;
	if (!path) return undefined;
	try {
		return unitDocumentation(await tree.read(path), unit.id, path);
	} catch {
		return { path, examples: [], gap: 'The document is not available at this commit.' };
	}
}
