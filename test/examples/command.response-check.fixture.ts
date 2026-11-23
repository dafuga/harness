import { Command } from 'commander';

/**
 * registerResponseCheckCommand is called on a program named as buildProgram names it. Its action
 * runs only through commander: a pre-action hook on the root records the parsed options and throws,
 * so the real check, which would read files and call JEV, never runs. Help and refused input stop
 * in commander before that hook. Registration stores nothing, so no temporary directory is used.
 */

/** A program whose output is captured and whose exits are thrown instead of made. */
export function harnessProgram(printed: string[]): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => {
				printed.push(text);
			},
			writeErr: (text) => {
				printed.push(text);
			},
			getOutHelpWidth: () => 80,
			getErrHelpWidth: () => 80
		});
}
