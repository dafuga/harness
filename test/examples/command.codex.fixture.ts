import { Command } from 'commander';
import { registerCodexCommand } from '../../src/cli/program/CodexCommand';

/** A made-up token of 40 characters: long enough for the length check, never a real credential. */
export const ownerToken = 'synthetic-gateway-token-0123456789abcdef';

export const ownerFile = `${ownerToken}\n`;

/** The value `codex serve` rejects with for these arguments, or undefined when it resolves. */
export function outcomeOf(args: string[]): Promise<unknown> {
	const root = new Command('harness').exitOverride();
	registerCodexCommand(root);
	const argv = ['codex', 'serve', ...args];
	return root.parseAsync(argv, { from: 'user' }).then(
		() => undefined,
		(error: unknown) => error
	);
}

/** A subcommand's name and options: flags, the mandatory marker where set, and the default. */
export function summaryOf(command: Command) {
	const options = command.options.map((option) => ({
		flags: option.flags,
		mandatory: option.mandatory || undefined,
		default: option.defaultValue
	}));
	return { name: command.name(), options };
}
