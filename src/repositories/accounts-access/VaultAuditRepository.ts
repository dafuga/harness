// @harness-uid u_hgig2hgaul
import {
	closeSync,
	constants,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeSync
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type {
	VaultAuditEvent,
	VaultAuditEventName,
	VaultAuditFields
} from './VaultAuditRepository.types';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/u);
const hex = z.string().regex(/^[0-9a-f]{32,64}$/u);
const fields = z.strictObject({
	request: hex,
	item: id,
	site: id,
	action: id,
	method: z.enum(['api-token', 'oauth-device', 'browser']),
	recipeDigest: hex,
	host: id,
	lease: hex.optional(),
	cause: id.optional()
});
const terminal = new Set<VaultAuditEventName>([
	'denial',
	'delivery',
	'password-complete',
	'password-failed',
	'expiry',
	'revoke',
	'lease-end'
]);

/**
 * The append-only, owner-only journal of requests and leases. Records are rebuilt from an
 * allowlist of identifier, digest and enum fields, so a secret cannot enter the journal.
 */
export class VaultAuditRepository {
	private readonly path: string;

	constructor(directory: string) {
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		this.path = join(directory, 'audit.jsonl');
	}

	append(entry: VaultAuditFields, event: VaultAuditEventName): VaultAuditEvent {
		const parsed = fields.safeParse(this.pick(entry));
		if (!parsed.success) throw new VaultBrokerError(500, 'Refused a malformed audit record.');
		const record: VaultAuditEvent = { ...parsed.data, event, time: new Date().toISOString() };
		const line = Buffer.from(JSON.stringify(record) + '\n');
		const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND;
		const fd = openSync(this.path, flags, 0o600);
		try {
			if (writeSync(fd, line) !== line.length) throw new ExpectedCliError('Partial audit write.');
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
		return record;
	}

	read(): VaultAuditEvent[] {
		let text = '';
		try {
			text = readFileSync(this.path, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code === 'ENOENT') return [];
			throw error;
		}
		return text
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as VaultAuditEvent);
	}

	/** Requests and leases with no terminal event, for recovery after a crash. */
	outstanding(): VaultAuditEvent[] {
		const open = new Map<string, VaultAuditEvent>();
		for (const event of this.read()) {
			const key = event.lease ?? event.request;
			if (terminal.has(event.event)) open.delete(key);
			else open.set(key, event);
			if (event.event === 'delivery') open.delete(event.request);
		}
		return [...open.values()];
	}

	private pick(entry: VaultAuditFields): VaultAuditFields {
		const { request, item, site, action, method, recipeDigest, host, lease, cause } = entry;
		return { request, item, site, action, method, recipeDigest, host, lease, cause };
	}
}

export type { VaultAuditEvent, VaultAuditFields } from './VaultAuditRepository.types';
