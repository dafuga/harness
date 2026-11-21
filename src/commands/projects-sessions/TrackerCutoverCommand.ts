// @harness-uid u_us5nnnvzqk
import { parseArgs } from 'node:util';
import { TrackerSnapshotAdapter } from '../../adapters/projects-sessions/TrackerSnapshotAdapter';
import type { TrackerSnapshotSyncOptions } from '../../adapters/projects-sessions/TrackerSnapshotAdapter.types';
import { TrackerSnapshotError } from '../../adapters/projects-sessions/tracker-snapshot-adapter/TrackerSnapshotError';

const usage =
	'Usage: harness tracker verify-cutover <before.sqlite> <after.sqlite> --node <node> [--hub-relay-ops] [--peer-relay-ops]';

export class TrackerCutoverCommand {
	run(args: string[]): number {
		const parsed = parseCutoverArgs(args);
		if (parsed?.values.help) {
			process.stdout.write(usage + '\n');
			return 0;
		}
		if (!parsed?.values.node || parsed.positionals.length !== 2 || /\s/.test(parsed.values.node)) {
			console.error(usage);
			return 2;
		}

		const [before, after] = parsed.positionals;
		return this.compare(before, after, {
			node: parsed.values.node,
			hubRelayOps: parsed.values['hub-relay-ops'],
			peerRelayOps: parsed.values['peer-relay-ops']
		});
	}

	private compare(before: string, after: string, options: TrackerSnapshotSyncOptions): number {
		try {
			const result = new TrackerSnapshotAdapter().compare(before, after, options);
			process.stdout.write(JSON.stringify(result, null, 2) + '\n');
			return result.matches ? 0 : 1;
		} catch (error) {
			if (!(error instanceof TrackerSnapshotError)) throw error;
			console.error(`tracker: ${error.message}`);
			return 2;
		}
	}
}

function parseCutoverArgs(args: string[]) {
	try {
		return parseArgs({
			args,
			allowPositionals: true,
			options: {
				node: { type: 'string' },
				'hub-relay-ops': { type: 'boolean' },
				'peer-relay-ops': { type: 'boolean' },
				help: { type: 'boolean', short: 'h' }
			}
		});
	} catch {
		return null;
	}
}
