// @harness-uid u_347cbx6yqx
import { realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { TrackerRehearsalService } from '../../services/projects-sessions/TrackerRehearsalService';

const usage =
	'Usage: harness tracker rehearse <private disposable SQLite copy under the system temp directory> --node <node> [--port <49152-65535>]';

export class TrackerRehearsalCommand {
	async run(args: string[]): Promise<number> {
		const input = parseRehearsalArgs(args);
		if (!input) {
			console.error(usage);
			return 2;
		}
		if (input.help) {
			console.log(usage);
			return 0;
		}
		const database = disposableDatabase(input.database);
		if (!database) {
			console.error('tracker: rehearsal needs a private disposable SQLite file.');
			return 2;
		}
		try {
			const owner = await new TrackerRehearsalService().start(database, input.node, input.port);
			await waitForStop(owner);
			return 0;
		} catch {
			console.error('tracker: could not start or close the isolated rehearsal service.');
			return 1;
		}
	}
}

function parseRehearsalArgs(args: string[]) {
	try {
		const { values, positionals } = parseArgs({
			args,
			allowPositionals: true,
			options: {
				node: { type: 'string' },
				port: { type: 'string' },
				help: { type: 'boolean', short: 'h' }
			}
		});
		if (values.help) return { help: true as const };
		const node = values.node;
		const port = Number(values.port ?? '0');
		if (!node || /\s/.test(node) || positionals.length !== 1 || !validPort(port)) return null;
		return { help: false as const, database: positionals[0], node, port };
	} catch {
		return null;
	}
}

function disposableDatabase(path: string): string | null {
	try {
		const file = realpathSync(path);
		const fromTemp = relative(realpathSync(tmpdir()), file);
		if (!fromTemp || fromTemp === '..' || fromTemp.startsWith('..' + sep) || isAbsolute(fromTemp)) {
			return null;
		}
		const stat = statSync(file);
		return stat.isFile() && stat.nlink === 1 && !(stat.mode & 0o077) ? file : null;
	} catch {
		return null;
	}
}

function validPort(port: number): boolean {
	return port === 0 || (Number.isInteger(port) && port >= 49152 && port <= 65535);
}

async function waitForStop(owner: Awaited<ReturnType<TrackerRehearsalService['start']>>) {
	let stop = () => {};
	const stopping = new Promise<void>((resolve) => {
		stop = resolve;
	});
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	try {
		const { node, port, pid } = owner;
		process.stdout.write(JSON.stringify({ node, port, pid }) + '\n');
		await stopping;
	} finally {
		process.removeListener('SIGINT', stop);
		process.removeListener('SIGTERM', stop);
		await owner.close();
	}
}
