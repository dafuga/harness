import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { caseOutcomeSchema } from '../../../../../core/verification-evidence/caseOutcomeSchema';

/** Keep the exact runner bytes as evidence, including failed attempts and skipped cases. */
export function readCaseResults(directory: string, relative: string) {
	const path = join(directory, 'case-results.ndjson');
	if (!existsSync(path)) return {};
	try {
		if (statSync(path).size > 2_000_000) throw new Error('case results exceed 2 MB');
		const bytes = readFileSync(path);
		const outcomes = bytes
			.toString('utf8')
			.split('\n')
			.filter(Boolean)
			.map((line) => caseOutcomeSchema.parse(JSON.parse(line)));
		return {
			cases: {
				outcomes,
				artifact: {
					path: `${relative}/case-results.ndjson`,
					bytes: bytes.length,
					sha256: createHash('sha256').update(bytes).digest('hex')
				}
			}
		};
	} catch (error) {
		return {
			failure: `Invalid case results: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}
