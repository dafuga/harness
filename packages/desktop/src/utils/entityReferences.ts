/** A piece of agent text: words as written, or a reference to a unit by its registered id. */
export type ReferencePart =
	| { kind: 'text'; text: string }
	| { kind: 'reference'; id: string; text: string };

/** The unit id grammar of the registry: lower-case dotted segments, at most 200 characters. */
const unitId = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
/** A marker holds no bracket and no space, so a broken one never swallows the next. */
const marker = /\[\[unit:([^\][\s]{1,201})\]\]/g;

/** Whether a value can be a registered unit id; it says nothing of whether one is registered. */
export function isUnitId(value: string): boolean {
	return value.length <= 200 && unitId.test(value);
}

/**
 * Cuts agent text into its words and its `[[unit:<id>]]` references, in order. A reference whose
 * id does not have the grammar, and one that is not closed yet, stays text exactly as written,
 * so the parts always join back into the text.
 */
export function entityReferences(value: string): ReferencePart[] {
	const parts: ReferencePart[] = [];
	let from = 0;
	for (const found of value.matchAll(marker)) {
		if (!isUnitId(found[1])) continue;
		if (found.index > from) parts.push({ kind: 'text', text: value.slice(from, found.index) });
		parts.push({ kind: 'reference', id: found[1], text: found[0] });
		from = found.index + found[0].length;
	}
	if (from < value.length) parts.push({ kind: 'text', text: value.slice(from) });
	return parts;
}
