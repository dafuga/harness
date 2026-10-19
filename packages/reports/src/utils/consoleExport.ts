

export interface ConsoleExportInput {
	commit: string;
	/** The record asked for; without one, the passing record of the commit, else its first. */
	record: string | null;
	/** JSON text of the history index and of the commit's revision detail. */
	index: string;
	detail: string;
	media(name: string): Promise<{ bytes: Uint8Array; type: string } | undefined>;
}

export { consoleExport } from './console-server/consoleExport';
