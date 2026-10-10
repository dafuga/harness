import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
	return out;
}
/** A small valid synthetic PNG; the shade makes each file distinct. */
export function png(shade: number): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(4, 0);
	header.writeUInt32BE(4, 4);
	header[8] = 8;
	const row = Buffer.alloc(5, shade);
	row[0] = 0;
	const pixels = deflateSync(Buffer.concat([row, row, row, row]));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk('IHDR', header),
		chunk('IDAT', pixels),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** Writes one run into a synthetic legacy store, with a small PNG asset when a shade is given. */
export async function legacyRun(
	target: { store: string; project: string },
	id: string,
	fields: Record<string, unknown>,
	shade?: number
): Promise<void> {
	const directory = join(target.store, 'runs', id);
	await mkdir(join(directory, 'assets'), { recursive: true });
	const file = `${id}-desktop.png`;
	if (shade !== undefined) await writeFile(join(directory, 'assets', file), png(shade));
	const evidence = [
		{
			id: 'shot',
			title: 'Dashboard',
			category: 'ui',
			file,
			status: 'passed',
			mediaType: 'image',
			mimeType: 'image/png',
			capturedAt: '2026-10-07T09:05:00.000Z',
			viewport: 'desktop'
		}
	];
	const manifest = {
		schemaVersion: 1,
		id,
		project: { id: 'demo', name: 'demo', path: target.project },
		title: `Legacy run ${id}`,
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt: '2026-10-07T09:00:00.000Z',
		updatedAt: '2026-10-07T09:10:00.000Z',
		summary: 'Synthetic legacy fixture.',
		status: 'passed',
		state: 'finalized',
		checks: [{ id: 'unit', title: 'Unit tests', status: 'passed', command: 'bun test' }],
		evidence: shade === undefined ? [] : evidence,
		findings: [],
		coverage: [],
		acceptance: [],
		...fields
	};
	await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
}
