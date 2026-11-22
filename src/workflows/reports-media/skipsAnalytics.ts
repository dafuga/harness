// @harness-uid u_6grsyr7ypn
/** Commands that only print a lookup; nothing about them is worth a stored event. */
const lookupCommands = new Set(['help', 'info', 'contracts']);
const versionFlags = new Set(['--version', '-V']);

/** True when the arguments only ask for help, the version or an `info` topic. Reads no state. */
export function skipsAnalytics(args: readonly string[]): boolean {
	if (args.length === 0) return true;
	const terminator = args.indexOf('--');
	const options = terminator < 0 ? args : args.slice(0, terminator);
	if (options.includes('--help') || options.includes('-h')) return true;
	return lookupCommands.has(args[0]) || versionFlags.has(args[0]);
}
