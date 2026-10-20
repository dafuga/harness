import type { ProjectProposal } from '../../../utils/projectProposal';
import { categories, type Category, type ContractField } from '../../../models/Desktop.types';
import type { ProjectRunRequest, ProposedContract } from '../../../models/DesktopBridge.types';
import { referencePrompt } from '../../../utils/referencePrompt';

const most = { answer: 20_000, title: 160, goal: 600, proposal: 6000 } as const;

/** A contract is a few short names: each list is bounded, and so is each entry of it. */
const bound = { entries: 24, entry: 160 } as const;

/** One Markdown fence around the object is the habit of a CLI; it is not part of the answer. */
const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/;

/** A title names a thing. A separator, a parent or a hidden name is a place, and is refused. */
const place = /[\\/\p{Cc}]|\.\.|^[.~]/u;

const refused = (why: string) => new Error(`The agent's proposal was not used: ${why}`);

/** An object that holds these fields and no other; `what` says which part of the answer it is. */
function only(value: unknown, fields: string[], what: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw refused(`${what} is not one JSON object.`);
	const other = Object.keys(value).filter((key) => !fields.includes(key));
	if (other.length) throw refused(`${what} has the unknown field ${other[0].slice(0, 40)}.`);
	return value as Record<string, unknown>;
}

function stated(answer: string): unknown {
	const body = answer.trim();
	if (body.length > most.answer) throw refused('it is too long.');
	try {
		return JSON.parse(fenced.exec(body)?.[1] ?? body);
	} catch {
		throw refused('it is not one JSON object.');
	}
}

function words(value: unknown, name: keyof typeof most): string {
	if (typeof value !== 'string' || !value.trim() || value.length > most[name])
		throw refused(`its ${name} is empty, too long or not text.`);
	return value.trim();
}

/** One short entry of a contract, kept exactly as it was written. */
function entry(value: unknown, what: string): string {
	if (typeof value !== 'string' || !value.trim() || value.length > bound.entry)
		throw refused(`a contract ${what} is empty, too long or not text.`);
	return value;
}

function listed<T>(value: unknown, what: string, read: (item: unknown) => T): T[] {
	if (!Array.isArray(value) || value.length > bound.entries)
		throw refused(`its contract ${what} are not a list of at most ${bound.entries}.`);
	return value.map(read);
}

function field(item: unknown): ContractField {
	const given = only(item, ['name', 'type'], 'a contract field');
	return { name: entry(given.name, 'name'), type: entry(given.type, 'type') };
}

/** What the new unit is proposed to take, give and refuse. All three lists are required. */
function proposedContract(value: unknown): ProposedContract {
	const given = only(value, ['inputs', 'outputs', 'errors'], 'its contract');
	const errors = listed(given.errors, 'errors', (item) => entry(item, 'error'));
	if (new Set(errors).size !== errors.length) throw refused('its contract repeats an error.');
	return {
		inputs: listed(given.inputs, 'inputs', field),
		outputs: listed(given.outputs, 'outputs', field),
		errors
	};
}

/**
 * The proposal an agent answered with, or an error before anything is written. Exactly five
 * fields are read and each is bounded: a field of another name, a kind that is not a catalog,
 * a title that reads as a path, notes that hold source code and a contract that is absent or
 * not in its form are all refused.
 */
export function projectProposal(answer: string): ProjectProposal {
	const fields = ['category', 'title', 'goal', 'proposal', 'contract'];
	const value = only(stated(answer), fields, 'it');
	if (!categories.includes(value.category as Category)) throw refused('its category is unknown.');
	const title = words(value.title, 'title');
	if (place.test(title)) throw refused('its title reads as a path.');
	const proposal = words(value.proposal, 'proposal');
	if (proposal.includes('```')) throw refused('its notes hold source code.');
	return {
		category: value.category as Category,
		title,
		goal: words(value.goal, 'goal'),
		proposal,
		contract: proposedContract(value.contract)
	};
}

/**
 * The one question of a creation run: an answer in a fixed form, and nothing written. `known`
 * are registered ids of the catalog the request was made in; the notes may name them.
 */
export function proposalPrompt(
	request: Pick<ProjectRunRequest, 'category' | 'text'>,
	known: string[] = []
): string {
	return [
		'Propose one new unit for this project. Write nothing.',
		'You may read AGENTS.md, the specifications and the unit registry with its contracts. Do not',
		'read the implementation of other registered units: rely on their contracts alone.',
		'Answer with one JSON object and nothing else, with exactly these five fields:',
		`{"category": one of ${categories.join(', ')}, "title": a short name in plain words,`,
		'"goal": one sentence saying what it is responsible for, "proposal": precise design or',
		'behavior notes, "contract": {"inputs": [{"name", "type"}], "outputs": [{"name", "type"}],',
		`"errors": [text]}}. A list holds at most ${bound.entries} entries of at most ${bound.entry}`,
		'characters each, and may be empty.',
		'The title is a name, never a path or a file name. The notes hold no source code, no file',
		'paths, no instruction to write files and no claim that anything was built, run or verified.',
		'Code is written only after a person approves the plan.',
		referencePrompt(known),
		'The notes may name existing units so; the title names the new unit in plain words.',
		`The request was made in the ${request.category} catalog. That is a hint: choose the kind`,
		'the request describes.',
		'Request:',
		request.text
	].join('\n');
}
