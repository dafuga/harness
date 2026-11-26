import { test } from 'vitest';
import type { Actor } from 'collaboration';
import type { EmailProofMessage } from '../../src/models/accounts-access/HubAuth.types';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import * as proof from '../../src/services/verification-evidence/email-proof-service/EmailProofService';
import * as repository from '../../src/repositories/projects-sessions/SessionRepository';
import { memoryAuthStore } from '../support/memoryAuthStore';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Cases } from './hub.service.email-proof.test.types';

/** The fixed clock every example starts from: 2026-11-16T12:40:00Z. */
const START = Date.UTC(2026, 10, 16, 12, 40);

function actor(subject: string, email: string, name: string): Actor {
	return { id: `google-${subject}`, email, name, emailVerified: true };
}
export const riley = actor('108213476590231574862', 'riley.morgan@example.com', 'Riley Morgan');
export const sam = actor('113406872215509283461', 'sam.ortega@example.org', 'Sam Ortega');

/** The real service over the in-memory store, a mailbox fake and a clock the test moves by hand. */
export function fixture() {
	const store = memoryAuthStore();
	let clock = START;
	const now = () => clock;
	const secrets = authSecrets('hub-email-proof-example-secret');
	const sessions = new repository.SessionRepository({ store: store.sessions, secrets, now });
	const mailbox = { sent: [] as EmailProofMessage[], failing: false };
	const delivery = {
		async send(message: EmailProofMessage) {
			if (mailbox.failing) throw new Error('provider refused the message');
			mailbox.sent.push(message);
		}
	};
	const options = { store, sessions, secrets, delivery, now };
	const service = new proof.EmailProofService(options);
	const move = (ms: number) => (clock += ms);
	return { store, secrets, sessions, mailbox, options, service, move };
}

/** Records one state's cases as its examples-cases evidence. */
export function record(symbol: string, state: string, cases: Cases): void {
	const target = { unitId: 'hub.service.email-proof', symbol, state, evidence: 'examples-cases' };
	recordExampleCases({ ...target, file: `${state}.json` }, cases);
}

test('open returns a pending cookie and stores only a keyed hash', async () => {
	const f = fixture();
	const first = await f.service.open(riley);
	const second = await f.service.open(riley);
	const unset = await new proof.EmailProofService({ ...f.options, delivery: null }).open(sam);
	expect(/^[\w-]{43}$/.test(first.cookie)).toBe(true);
	expect(first.status).toEqual({ email: riley.email, sent: false, expiresAt: null });
	const keyed = await f.secrets.hash('email-proof', first.cookie);
	expect(f.store.dump().includes(keyed)).toBe(true);
	expect(f.store.dump().includes(first.cookie)).toBe(false);
	expect(second.cookie !== first.cookie).toBe(true);
	expect(unset.status).toEqual({ email: sam.email, sent: false, expiresAt: null });
	record('open', 'open-returns-a-pending-cookie-and-stores-only-a-keyed-hash', [
		{ name: 'riley opens a pending proof', input: { actor: riley }, output: first.status },
		{ name: 'riley opens a second proof', input: { actor: riley }, output: second.status },
		{ name: 'sam, with no delivery', input: { actor: sam, delivery: null }, output: unset.status }
	]);
});
