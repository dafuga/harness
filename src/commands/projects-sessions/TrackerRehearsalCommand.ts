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
		if (input?.values.help) {
			console.log(usage);
			return 0;
		}
		const node = input?.values.node;
		const port = Number(input?.values.port ?? '0');
		if (!node || /\s/.test(node) || input?.positionals.length !== 1 || !validPort(port)) {
			console.error(usage);
			return 2;
		}
		const database = disposableDatabase(input.positionals[0]);
		if (!database) {
			console.error('tracker: rehearsal needs a private disposable SQLite file.');
			return 2;
		}
		try {
			const owner = await new TrackerRehearsalService().start(database, node, port);
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
		return parseArgs({
			args,
			allowPositionals: true,
			options: {
				node: { type: 'string' },
				port: { type: 'string' },
				help: { type: 'boolean', short: 'h' }
			}
		});
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
