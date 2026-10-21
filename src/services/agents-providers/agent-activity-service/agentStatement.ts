import type { AgentInput, AgentStatement } from '../../../utils/agents-providers/agentStatement';
import { fail } from '../../../core/development-tooling/errors';

const lengths = { label: 120, provider: 80, model: 80, task: 200, loop: 80, outcome: 200 } as const;

const idShape = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const unitShape = /^[a-z0-9][a-z0-9.-]{0,119}$/;

const quarterHour = 900;

const longest = 24 * 60 * 60;

/** A short line of text; control characters and anything longer than its limit are refused. */
function line(input: AgentInput, key: keyof typeof lengths): string | undefined {
	const value = input[key]?.trim();
	if (!value) return undefined;
	const printable = [...value].every((character) => character >= ' ' && character !== '\x7f');
	if (value.length > lengths[key] || !printable) {
		return fail(`--${key} must be one line of at most ${lengths[key]} characters.`);
	}
	return value;
}

function whole(value: string | undefined, name: string, most: number): number | undefined {
	if (value === undefined) return undefined;
	const number = Number(value);
	if (!Number.isInteger(number) || number < 1 || number > most) {
		return fail(`--${name} must be a whole number from 1 to ${most}.`);
	}
	return number;
}

function units(value: string | undefined): string[] | undefined {
	if (value === undefined) return undefined;
	const ids = [
		...new Set(
			value
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
		)
	].sort();
	if (ids.length > 40 || !ids.every((id) => unitShape.test(id))) {
		return fail('--units must be at most 40 unit ids, separated by commas.');
	}
	return ids;
}

/**
 * Checks what an owner states about an agent and gives it back in the form it is kept. Only
 * these few short facts are accepted: no free text beyond a line, nothing that can name a path.
 */
export function agentStatement(input: AgentInput): AgentStatement {
	if (input.id !== undefined && !idShape.test(input.id)) {
		fail('--id must be letters, digits, dots, dashes or underscores, 64 at most.');
	}
	return {
		id: input.id,
		label: line(input, 'label'),
		provider: line(input, 'provider'),
		model: line(input, 'model'),
		task: line(input, 'task'),
		loop: line(input, 'loop'),
		units: units(input.units),
		pid: whole(input.pid, 'pid', 2 ** 31 - 1) ?? null,
		ttlSeconds: whole(input.ttl, 'ttl', longest) ?? quarterHour,
		outcome: line(input, 'outcome')
	};
}
