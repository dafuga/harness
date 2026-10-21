import { isUnitId } from './entityReferences';

/** How many ids one prompt lists; a unit beyond them is named in words. */
const most = 120;

/**
 * The lines that ask an agent to name units as references, with the registered ids it may name:
 * each once, in the order given, and only ids of the unit id grammar. No source is in them.
 */
export function referencePrompt(ids: string[], discover = false): string {
	const named = [...new Set(ids.filter(isUnitId))].slice(0, most);
	const listed = named.length ? named.map((id) => `[[unit:${id}]]`).join(', ') : 'none';
	return [
		'Name a unit as [[unit:<id>]] with its registered id, never by a file name, a path or a',
		discover
			? 'guessed id. For another unit, first read its canonical manifest at the selected revision; use only its verified id.'
			: 'guessed id. Name a unit that is not listed here in plain words.',
		`Units you may name: ${listed}`
	].join('\n');
}
