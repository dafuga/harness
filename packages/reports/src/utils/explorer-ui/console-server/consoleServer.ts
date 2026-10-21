import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
	consoleAccess,
	consolePolicy,
	type ConsoleAccess,
	type ConsoleData
} from '../../../../../../src/lib/console';
import { ReportExportSerializer } from '../../../serializers/reports-media/ReportExportSerializer';
import { consoleExport } from './consoleExport';
import { mediaMime } from '../../verification-evidence/evidenceMedia';
import { reportRuntimeRoot } from '../../reports-media/reportRuntimeRoot';

/** The directory `harness history build` wrote, when this server was given one. */
export function consoleDirectory(): string | undefined {
	const directory = process.env.HARNESS_CONSOLE_DATA?.trim();
	return directory ? resolve(directory) : undefined;
}

async function inside(directory: string | undefined, path: string): Promise<Buffer | undefined> {
	if (!directory) return undefined;
	const target = resolve(directory, path);
	if (!target.startsWith(directory + sep)) return undefined;
	return readFile(target).catch(() => undefined);
}

/** Console data read from the history directory on disk; used by Harness's own local server. */
function consoleFiles(): ConsoleData {
	return {
		async json(path) {
			return (await inside(consoleDirectory(), path))?.toString('utf8');
		},
		async media(name) {
			const bytes = await inside(consoleDirectory(), `media/${name}`);
			return bytes ? { bytes: new Uint8Array(bytes), type: mediaMime(name) } : undefined;
		}
	};
}

/** The history files themselves, for server code that has already passed the guard. */
export const consoleData: ConsoleData = consoleFiles();

let access: ConsoleAccess | undefined;

/**
 * The guard in front of everything this server serves. Harness's own server has one owner: it
 * admits a request only in explicit owner mode, bound to loopback, from a loopback peer.
 */
export function consoleServer(): ConsoleAccess {
	access ??= consoleAccess({
		policy: consolePolicy({
			mode: process.env.HARNESS_OWNER_MODE,
			bind: process.env.HARNESS_BIND ?? process.env.HOST,
			addressHeader: process.env.ADDRESS_HEADER
		}),
		data: consoleData,
		// The portable page is built with the viewer this server compiled.
		exporter: async (input) =>
			consoleExport(input, await new ReportExportSerializer(reportRuntimeRoot()).assets())
	});
	return access;
}
