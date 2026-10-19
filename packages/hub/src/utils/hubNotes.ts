import { readNoteLines, type ReadNote } from '../../../../src/utils/noteLines';
import type { HubSourceContext } from './hubSource';
import { hubRaw } from './hubRaw';
import { hubFail } from './hubJson';
import { hubPinnedSource } from './hubPinnedSource';

/** Caller owns one immutable authorized context. Its memo never crosses principals. */
const pending = new WeakMap<HubSourceContext, Map<string, Promise<Map<string, ReadNote>>>>();
export function hubNotes(
	base: HubSourceContext,
	pinned: string | null
): Promise<Map<string, ReadNote>> {
	if (pinned === null) return Promise.resolve(new Map());
	const reads = pending.get(base) ?? new Map();
	pending.set(base, reads);
	if (!reads.has(pinned)) reads.set(pinned, load(base, pinned));
	return reads.get(pinned)!;
}

async function load(base: HubSourceContext, pinned: string): Promise<Map<string, ReadNote>> {
	const source = await hubPinnedSource(base, pinned);
	const notes = new Map<string, ReadNote>();
	for (const entry of source.entries) {
		const commit = entry.path.replaceAll('/', '');
		if (entry.type !== 'blob' || !/^[a-f0-9]{40}$/.test(commit)) continue;
		if (!['100644', '100755'].includes(entry.mode) || notes.has(commit))
			return hubFail('invalid-notes');
		const text = new TextDecoder('utf-8', { fatal: true }).decode(await hubRaw(source, entry));
		notes.set(commit, readNoteLines(text, commit));
	}
	return notes;
}
