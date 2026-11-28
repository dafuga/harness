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
			'Local: instructions [--check] [file...]\n' +
			'Run work on another computer: host-work <ssh|colima> <computer> -- <command> [args...]\n' +
			'Subcommands: autolaunch [status|dry-run|pause|resume|clear-quota <codex|claude>], ' +
			`${nativeTrackerAdapterUsage}, ` +
			'backup now|list|verify <file>|restore <file> --to <new path> [--without-local-state], ' +
			'web-push setup --origin https://<hub> [--rotate]|status\n' +
			'Host commands: health [--alert], supervise, service print|install|uninstall\n' +
			'Ask review: flag queues a draft with Chief of Staff. Waiting-on-Daniel blocks and alerts go there too.\n' +
			'Chief of Staff: review [id] --by "Chief of Staff", answer <id> "<answer>" --by "Chief of Staff",\n' +
			'  or release <id> "<question>" --option "<label>=<effect>" --option "<label>=<effect>" --recommend N --by "Chief of Staff".\n' +
			nativeTrackerJobHelp
	);
	return 0;
}
