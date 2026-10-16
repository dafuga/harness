import type {
	DeviceRecord,
	HostRecord,
	PairingRecord,
	RateBucket,
	RateRecord
} from '../models/RelayHost.types';

const upsert =
	'INSERT INTO records (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value';

/**
 * Everything a host object keeps, as JSON records in its SQLite storage: `host`, `device:<id>`,
 * `pairing:<id>` and `rate:<bucket>`. Reads and writes are synchronous, so a decision and the
 * write that follows it cannot be interleaved. The table is created by the first write: an
 * object that was only ever asked about a host that does not exist stores nothing.
 */
export class HostStorageAdapter {
	private created = false;

	constructor(private readonly storage: DurableObjectStorage) {}

	host(): HostRecord | undefined {
		return this.read('host');
	}
	saveHost(record: HostRecord): void {
		this.write('host', record);
	}
	device(deviceId: string): DeviceRecord | undefined {
		return this.read(`device:${deviceId}`);
	}
	devices(): DeviceRecord[] {
		return this.list('device:');
	}
	saveDevice(record: DeviceRecord): void {
		this.write(`device:${record.deviceId}`, record);
	}
	removeDevice(deviceId: string): void {
		this.remove(`device:${deviceId}`);
	}
	pairing(pairingId: string): PairingRecord | undefined {
		return this.read(`pairing:${pairingId}`);
	}
	pairings(): PairingRecord[] {
		return this.list('pairing:');
	}
	savePairing(record: PairingRecord): void {
		this.write(`pairing:${record.pairingId}`, record);
	}
	removePairing(pairingId: string): void {
		this.remove(`pairing:${pairingId}`);
	}
	rate(bucket: RateBucket): RateRecord | undefined {
		return this.read(`rate:${bucket}`);
	}
	saveRate(bucket: RateBucket, record: RateRecord): void {
		this.write(`rate:${bucket}`, record);
	}

	/** When the alarm of the object rings next, if at all. */
	async alarmAt(time: number | undefined): Promise<void> {
		if (time === undefined) await this.storage.deleteAlarm();
		else await this.storage.setAlarm(time);
	}

	/** Deletes every record and the alarm. */
	async clear(): Promise<void> {
		await this.storage.deleteAlarm();
		await this.storage.deleteAll();
		this.created = false;
	}

	private exists(): boolean {
		if (this.created) return true;
		const query = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'records'";
		this.created = this.storage.sql.exec(query).toArray().length > 0;
		return this.created;
	}

	private read<T>(key: string): T | undefined {
		if (!this.exists()) return undefined;
		const rows = this.storage.sql.exec('SELECT value FROM records WHERE key = ?', key).toArray();
		return rows.length > 0 ? (JSON.parse(String(rows[0].value)) as T) : undefined;
	}

	private list<T>(prefix: string): T[] {
		if (!this.exists()) return [];
		const query = 'SELECT value FROM records WHERE substr(key, 1, ?) = ? ORDER BY key';
		const rows = this.storage.sql.exec(query, prefix.length, prefix).toArray();
		return rows.map((row) => JSON.parse(String(row.value)) as T);
	}

	private write(key: string, value: unknown): void {
		if (!this.exists()) {
			const create =
				'CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)';
			this.storage.sql.exec(`${create} WITHOUT ROWID`);
			this.created = true;
		}
		this.storage.sql.exec(upsert, key, JSON.stringify(value));
	}

	private remove(key: string): void {
		if (this.exists()) this.storage.sql.exec('DELETE FROM records WHERE key = ?', key);
	}
}
