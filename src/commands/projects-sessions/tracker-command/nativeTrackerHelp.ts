// @harness-uid u_r7qgepnoax
import { nativeTrackerAdapterUsage } from './nativeTrackerAdapterRequest';
import { nativeTrackerJobHelp } from './nativeTrackerJobRequest';
import { nativeTrackerCommands } from './nativeTrackerRequest';

export function wantsNativeTrackerHelp(args: string[]): boolean {
	if (args[0] === 'host-work' && args.length > 2) return false;
	return (args[0] ?? 'help') === 'help' || args.includes('--help') || args.includes('-h');
}

export function printNativeTrackerHelp(): number {
	console.log(
		`Usage: tracker <command> [arguments] [--json]\nNative commands: ${nativeTrackerCommands}\n` +
			'Session rules: rule add "<rule>" --from <incident> --skill <name> | rule list [--skill <name>] [--limit <count>]\n' +
			'Local: instructions [--check] [file...]\n' +
			'Run work on another computer: host-work <ssh|colima> <computer> -- <command> [args...]\n' +
			'Subcommands: autolaunch [status|dry-run|pause|resume|clear-quota <codex|claude>], ' +
			`${nativeTrackerAdapterUsage}, ` +
			'backup now|list|verify <file>|restore <file> --to <new path> [--without-local-state], ' +
			'web-push setup --origin https://<hub> [--rotate]|status\n' +
			'Host commands: health [--alert], supervise, service print|install|uninstall\n' +
			nativeTrackerJobHelp
	);
	return 0;
}
