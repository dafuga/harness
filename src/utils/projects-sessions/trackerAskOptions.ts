// @harness-uid u_liy3gizotu
// @harness-uid u_ask0pt10ns
import { trackerItemError } from './trackerItemError';
import type { TrackerItemValue } from './normalizeTrackerItemFields.types';
import type { TrackerAskConfirm, TrackerAskOption } from './trackerAskOptions.types';

/** Asks of these kinds change something that is hard to undo, so a tap needs a confirm step. */
export const trackerAskConfirmKinds: readonly TrackerAskConfirm[] = ['deploy', 'money', 'secret'];

const minOptions = 2;
const maxOptions = 4;
const maxLabel = 80;
const maxEffect = 400;

/** Parse a "label=effect" CLI word. The effect is optional. */
export function trackerAskOptionFromWord(word: string): { label: string; effect: string } {
	const at = word.indexOf('=');
	if (at < 0) return { label: word.trim(), effect: '' };
	return { label: word.slice(0, at).trim(), effect: word.slice(at + 1).trim() };
}

/** Validate caller options into the stored JSON text. Null or empty clears them. */
export function normalizeTrackerAskOptions(value: TrackerItemValue): string | null {
	if (value === null || value === '' || value === undefined) return null;
	const list = typeof value === 'string' ? parseJson(value) : value;
	if (!Array.isArray(list)) throw trackerItemError('options must be a list of 2 to 4 choices');
	if (list.length < minOptions || list.length > maxOptions)
		throw trackerItemError(`options need ${minOptions} to ${maxOptions} choices`);
	const options = list.map(oneOption);
	checkLabels(options.map((option) => option.label.toLowerCase()));
	if (options.filter((option) => option.recommended).length > 1)
		throw trackerItemError('mark at most one option as recommended');
	return JSON.stringify(options);
}

/** Labels tell choices apart, and "Other" belongs to the written answer every ask already has. */
function checkLabels(labels: string[]): void {
	if (new Set(labels).size !== labels.length)
		throw trackerItemError('option labels must be distinct');
	if (labels.some((label) => /^other\b/.test(label)))
		throw trackerItemError('"Other" is always offered for a written answer; do not add it');
}

function parseJson(text: string): TrackerItemValue {
	try {
		return JSON.parse(text);
	} catch {
		throw trackerItemError('options must be a list of 2 to 4 choices');
	}
}

function oneOption(raw: TrackerItemValue): TrackerAskOption {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
		throw trackerItemError('each option needs a label');
	const entry = raw as Record<string, TrackerItemValue>;
	const label = typeof entry.label === 'string' ? entry.label.trim() : '';
	const effect = typeof entry.effect === 'string' ? entry.effect.trim() : '';
	if (!label) throw trackerItemError('each option needs a label');
	if (label.length > maxLabel)
		throw trackerItemError(`option label is over ${maxLabel} characters`);
	if (effect.length > maxEffect)
		throw trackerItemError(`option effect is over ${maxEffect} characters`);
	return { label, effect, ...(entry.recommended ? { recommended: true as const } : {}) };
}

/** Read stored options. Unreadable or missing text means the ask has none. */
export function trackerAskOptions(stored: string | null | undefined): TrackerAskOption[] {
	if (!stored) return [];
	try {
		const list = JSON.parse(stored);
		return Array.isArray(list) ? (list as TrackerAskOption[]) : [];
	} catch {
		return [];
	}
}

export function normalizeTrackerAskConfirm(value: TrackerItemValue): string | null {
	if (value === null || value === '' || value === undefined || value === 'none') return null;
	if (!(trackerAskConfirmKinds as readonly string[]).includes(String(value)))
		throw trackerItemError(`confirm must be one of ${trackerAskConfirmKinds.join(', ')}`);
	return String(value);
}

/** Resolve a 1-based option number against the ask the caller was shown. */
export function chosenTrackerAskOption(
	stored: string | null | undefined,
	choice: TrackerItemValue
): { index: number; option: TrackerAskOption } {
	const options = trackerAskOptions(stored);
	if (!options.length) throw trackerItemError('this ask has no options', 409);
	const index = Number(choice) - 1;
	if (!Number.isInteger(index) || index < 0 || index >= options.length)
		throw trackerItemError(`option must be 1 to ${options.length}`);
	return { index, option: options[index] };
}

/** Attachment fields are only ever set by the flag step, already validated and packed. */
function storedText(value: TrackerItemValue): string | null {
	return value === null ? null : String(value);
}

/** How the ask's fields are checked on the way into an item. */
export const trackerAskNormalizers = {
	options: normalizeTrackerAskOptions,
	confirm: normalizeTrackerAskConfirm,
	answer_option: (value: TrackerItemValue) => (value === null ? null : String(value)),
	attachments: storedText,
	attachment_docs: storedText
};
