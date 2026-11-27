import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import {
	beginResource,
	markResource,
	readResource
} from '../../../src/commands/projects-sessions/tracker-hygiene-command/hygieneLedger';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

test('the run ledger owns its entries and closes admission when cleanup starts', () =>
	measureWorkload('command.projects-sessions-tracker-hygiene', 'private-ledger-lifecycle', () =>
		withTempDir('run-resource-ledger-', (root) => {
			const ledger = join(root, 'ledger');
			mkdirSync(ledger, { mode: 0o700 });
			vi.stubEnv('HARNESS_TRACKER_HYGIENE', ledger);
			try {
				const entry = beginResource({ kind: 'process' });
				expect(readResource(entry)).toEqual({ kind: 'process' });
				markResource(ledger, 'closing');
				expect(() => beginResource({ kind: 'process' })).toThrow('Tracker run is closing');
				expect(readFileSync(join(ledger, 'closing'), 'utf8')).toBe('');
				const unrelated = join(ledger, 'unrelated');
				symlinkSync(entry, unrelated);
				expect(() => readResource(unrelated)).toThrow('Invalid run resource receipt');
			} finally {
				vi.unstubAllEnvs();
			}
		})
	));
