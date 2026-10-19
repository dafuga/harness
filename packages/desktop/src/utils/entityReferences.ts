/** A piece of agent text: words as written, or a reference to a unit by its registered id. */
export type ReferencePart =
	| { kind: 'text'; text: string }
	| { kind: 'reference'; id: string; text: string };

/** The unit id grammar of the registry: lower-case dotted segments, at most 200 characters. */
const unitId = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

/** Whether a value can be a registered unit id; it says nothing of whether one is registered. */
export function isUnitId(value: string): boolean {
	return value.length <= 200 && unitId.test(value);
}

export { entityReferences } from '../components/reference-text/entityReferences';
