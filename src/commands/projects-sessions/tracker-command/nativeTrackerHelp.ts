// @harness-uid u_r7qgepnoax
import { nativeTrackerAdapterUsage } from './nativeTrackerAdapterRequest';
import { nativeTrackerJobHelp } from './nativeTrackerJobRequest';
import { nativeTrackerCommands } from './nativeTrackerRequest';

export function wantsNativeTrackerHelp(args: string[]): boolean {
	return (args[0] ?? 'help') === 'help' || args.includes('--help') || args.includes('-h');
}

export function printNativeTrackerHelp(): number {
	console.log(
		`Usage: tracker <command> [arguments] [--json]\nNative commands: ${nativeTrackerCommands}\n` +
			'Local: instructions [--check] [file...]\n' +
			`Subcommands: autolaunch [status|dry-run], ${nativeTrackerAdapterUsage}, ` +
			'backup now|list|verify <file>|restore <file> --to <new path> [--without-local-state]\n' +
			nativeTrackerJobHelp
	);
	return 0;
}
