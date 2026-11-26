// @harness-uid u_jqap3ixjqt
/** How to start this same Harness again: a compiled binary alone, or the runtime plus its entry. */
export function harnessSelfCommand(
	argv: string[] = process.argv,
	runtime: string = process.execPath
) {
	const entry = argv[1];
	return !entry || entry.startsWith('/$bunfs/') ? [runtime] : [runtime, entry];
}
