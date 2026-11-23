import type { Command } from 'commander';
import { vi } from 'vitest';

export async function invoke(
	command: Command,
	args: string[]
): Promise<{ output: unknown } | { error: { name: string; message: string } }> {
	const output: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((...values) => {
		output.push(values.map(String).join(' '));
	});
	let thrown: unknown;
	try {
		await command.parseAsync(args, { from: 'user' });
	} catch (error) {
		thrown = error;
	} finally {
		log.mockRestore();
	}
	if (thrown !== undefined)
		return {
			error:
				thrown instanceof Error
					? { name: thrown.name, message: thrown.message }
					: { name: typeof thrown, message: String(thrown) }
		};
	return { output: JSON.parse(output[0] ?? 'null') };
}
