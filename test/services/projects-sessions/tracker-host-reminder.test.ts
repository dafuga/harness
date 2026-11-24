import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

test('the primary hub delivers a reminder once through its CoS host binding without a webhook', () =>
	withTempDir('hnt-reminder-', async (root) => {
		const executable = join(root, 'watchdog');
		const receipts = join(root, 'receipts.ndjson');
		writeFileSync(executable, `#!${process.execPath}\n${driver}`, { mode: 0o700 });
		const db = new DatabaseSync(':memory:');
		let now = Date.parse('2026-11-24T02:00:00Z');
		const wake = now + 60_000;
		const create = () =>
			new TrackerNativeRuntimeService(db, {
				node: 'daniel-primary-mbp',
				role: 'hub',
				now: () => now,
				hostEffects: { watchdog: { driver: executable, chiefOfStaff: true } }
			});
		try {
			const runtime = create();
			runtime.store.appendLocal({
				itemId: 'fixture123',
				fields: {
					title: 'Synthetic reminder',
					status: 'open',
					remind_at: new Date(wake).toISOString()
				}
			});
			await runtime.notifications?.tick();
			expect(existsSync(receipts)).toBe(false);
			now = wake;
			await measureWorkload(
				'service.projects-sessions-tracker-native-runtime',
				'scheduled-host-reminder',
				() => runtime.notifications?.tick()
			);
			await create().notifications?.tick();
			const lines = readFileSync(receipts, 'utf8').trim().split('\n');
			expect(lines.map((line) => JSON.parse(line))).toMatchObject([
				{
					operation: 'watchdog-cos',
					alerts: [{ item_id: 'fixture123', kind: 'remind_at', at: wake }]
				}
			]);
		} finally {
			db.close();
		}
	}));

const driver = `
const { appendFileSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const alerts = JSON.parse(readFileSync(0, 'utf8')).alerts;
const operation = process.argv[2];
appendFileSync(join(dirname(process.argv[1]), 'receipts.ndjson'), JSON.stringify({ operation, alerts }) + '\\n');
process.stdout.write(JSON.stringify({ sent: true }));
`;
