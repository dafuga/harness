import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { browserDiagnosticSchema, type BrowserDiagnostic } from '../../core/browserDiagnostics';

type Read = { browserErrors?: BrowserDiagnostic[]; failure?: string };

/** Read only this check's diagnostics. Absence says nothing about an older test's monitoring. */
export function readBrowserDiagnostics(directory: string): Read {
	const path = join(directory, 'browser-errors.ndjson');
	try {
		const file = lstatSync(path);
		if (!file.isFile() || file.size > 2_000_000)
			return { failure: 'Browser diagnostics must be a regular file of at most 2000000 bytes.' };
		const lines = readFileSync(path, 'utf8')
			.split('\n')
			.filter((line) => line.trim());
		const browserErrors = lines.map((line) => browserDiagnosticSchema.parse(JSON.parse(line)));
		return browserErrors.length ? { browserErrors } : {};
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return {};
		return { failure: 'Browser diagnostics could not be read or did not match their schema.' };
	}
}
