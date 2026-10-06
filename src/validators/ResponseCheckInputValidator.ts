import type { ResponseCriterion } from '../core/responseCheckTypes';

export class ResponseCheckInputValidator {
	validateCriteria(raw: unknown): ResponseCriterion[] {
		if (!Array.isArray(raw)) throw new Error('Criteria must be a JSON array.');
		const seen = new Set<string>();
		return raw.map((value: unknown) => parseCriterion(value, seen));
	}
}

function parseCriterion(value: unknown, seen: Set<string>): ResponseCriterion {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Each criterion needs an id and description.');
	const raw = value as Record<string, unknown>;
	const id = requiredText(raw.id);
	const description = requiredText(raw.description);
	if (seen.has(id)) throw new Error('Criterion ids must be unique.');
	seen.add(id);
	return { id, description };
}

function requiredText(value: unknown): string {
	if (typeof value !== 'string' || !value.trim())
		throw new Error('Criterion ids and descriptions must be nonempty strings.');
	return value.trim();
}
