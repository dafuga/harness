import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	BROWSER_TTL,
	NATIVE_TTL,
	SessionRepository
} from '../../src/repositories/projects-sessions/SessionRepository';
import type {
	SessionRepositoryOptions,
	SessionGrant,
	IssuedSession
} from '../../src/repositories/projects-sessions/SessionRepository.types';
import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';

const actor = {
	id: 'google-11739284015673928104',
	email: 'alex.morgan@example.com',
	name: 'Alex Morgan',
	emailVerified: true as const
};
const grant: SessionGrant = { kind: 'browser', actor, resource: 'projects', parentHash: null };
const hash = 'd4d8393b52e2d1186c50d8af9c290b6a5f3471c8e2d9a6403b7c1f85a6e40d72';
const timestamp = 1700000000000;

function fixture(): {
	repository: SessionRepository;
	records: Map<string, SessionRecord>;
	revocations: Array<[string, number]>;
	directory: string;
} {
	const records = new Map<string, SessionRecord>();
	const revocations: Array<[string, number]> = [];
	const options: SessionRepositoryOptions = {
		store: {
			devices: async () => [],
			removeDevice: async () => false,
			touchDevice: async () => {},
			async create(record) {
				records.set(record.idHash, record);
			},
			async find(idHash) {
				return records.get(idHash) ?? null;
			},
			async revoke(idHash, now) {
				revocations.push([idHash, now]);
			}
		},
		secrets: {
			async hash(purpose, value) {
				return `${purpose}:${value}`;
			},
			async seal() {
				return '';
			},
			async open() {
				return null;
			}
		},
		now: () => timestamp
	};
	return {
		repository: new SessionRepository(options),
		records,
		revocations,
		directory: mkdtempSync(join(tmpdir(), 'session-repository-'))
	};
}

function cleanup(directory: string): void {
	rmSync(directory, { recursive: true, force: true });
}

function recordSummary(record: SessionRecord): SessionRecord {
	return { ...record };
}

test('Issues a browser session with its credential hash', async () => {
	const context = fixture();
	try {
		const issued: IssuedSession = await context.repository.issue(grant);
		const stored = context.records.get(`session:${issued.credential}`);
		expect(stored).toEqual(issued.record);
		expect(issued.record.expiresAt).toBe(timestamp + BROWSER_TTL);
		recordExampleCases(
			{
				unitId: 'hub.repository.session',
				symbol: 'SessionRepository.issue',
				state: 'issues-a-browser-session-with-its-credential-hash',
				evidence: 'examples-cases',
				file: 'issues-a-browser-session-with-its-credential-hash.json'
			},
			[
				{
					name: 'browser grant is persisted with its opaque credential hash',
					input: grant,
					output: {
						credential: issued.credential,
						record: recordSummary(issued.record),
						browserTtl: BROWSER_TTL,
						nativeTtl: NATIVE_TTL
					}
				}
			]
		);
	} finally {
		cleanup(context.directory);
	}
});

test('Finds live credentials and rejects expired sessions', async () => {
	const context = fixture();
	try {
		const issued = await context.repository.issue(grant);
		const found = await context.repository.find(issued.credential);
		const expiredRecord = { ...issued.record, idHash: hash, expiresAt: timestamp };
		context.records.set(hash, expiredRecord);
		const expired = await context.repository.live(hash);
		expect(found).toEqual(issued.record);
		expect(expired).toBeNull();
		recordExampleCases(
			{
				unitId: 'hub.repository.session',
				symbol: 'SessionRepository.find',
				state: 'finds-live-credentials-and-rejects-expired-sessions',
				evidence: 'examples-cases',
				file: 'finds-live-credentials-and-rejects-expired-sessions.json'
			},
			[
				{
					name: 'credential lookup returns the live stored record',
					input: { credential: issued.credential },
					output: found
				},
				{
					name: 'record expiring at the current clock is not live',
					input: { idHash: hash, expiresAt: timestamp },
					output: expired
				}
			]
		);
	} finally {
		cleanup(context.directory);
	}
});

test('Revokes a session and sessions issued from its origin', async () => {
	const context = fixture();
	try {
		const record: SessionRecord = {
			idHash: hash,
			...grant,
			createdAt: timestamp,
			expiresAt: timestamp + BROWSER_TTL,
			revokedAt: null
		};
		await context.repository.revoke(record);
		await context.repository.revokeIssuedFrom('parent-session-hash');
		expect(context.revocations).toEqual([
			[hash, timestamp],
			['parent-session-hash', timestamp]
		]);
		recordExampleCases(
			{
				unitId: 'hub.repository.session',
				symbol: 'SessionRepository.revoke',
				state: 'revokes-a-session-and-sessions-issued-from-its-origin',
				evidence: 'examples-cases',
				file: 'revokes-a-session-and-sessions-issued-from-its-origin.json'
			},
			[
				{
					name: 'session and origin hashes are revoked at the current time',
					input: { record, parentHash: 'parent-session-hash' },
					output: context.revocations
				}
			]
		);
	} finally {
		cleanup(context.directory);
	}
});
