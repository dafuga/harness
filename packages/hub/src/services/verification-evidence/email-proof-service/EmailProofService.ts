import type { EmailProofOptions, Pending } from './EmailProofService.types';
import type { Actor } from 'collaboration';
import type {
	EmailProofDelivery,
	EmailProofMessage,
	EmailProofStatus
} from '../../../models/accounts-access/HubAuth.types';
import type { EmailProofRecord } from '../../../models/accounts-access/HubAuthStore.types';
import type { IssuedSession } from '../../../repositories/projects-sessions/SessionRepository';
import { authFail } from '../../../utils/accounts-access/authFail';
import { emailCode } from './authSecrets';
import { randomToken } from '../../../utils/verification-evidence/authSecrets';

export const PENDING_TTL = 10 * 60 * 1000;

export const CODE_TTL = 10 * 60 * 1000;

export const MAX_ATTEMPTS = 5;

export const SEND_INTERVAL = 60 * 1000;

export const DAILY_SENDS = 5;

/** How long a proven address lets its Google subject sign in without a new proof. */
export const PROOF_TTL = 30 * 24 * 60 * 60 * 1000;

const DAY = 24 * 60 * 60 * 1000;

function emailHash(options: EmailProofOptions, email: string): Promise<string> {
	return options.secrets.hash('email-address', email);
}

/** One send a minute and a daily cap, counted for the Google subject and for the address. */
async function allowed(options: EmailProofOptions, actor: Actor): Promise<boolean> {
	const { store, now } = options;
	const at = now();
	const window = {
		now: at,
		day: Math.floor(at / DAY),
		since: at - SEND_INTERVAL,
		cap: DAILY_SENDS
	};
	if (!(await store.emailLedger.allow({ key: `actor:${actor.id}`, ...window }))) return false;
	const address = `email:${await emailHash(options, actor.email)}`;
	return store.emailLedger.allow({ key: address, ...window });
}

/** Whatever the delivery throws becomes one code. Its message is never passed on. */
async function deliver(delivery: EmailProofDelivery, message: EmailProofMessage): Promise<void> {
	try {
		await delivery.send(message);
	} catch {
		return authFail('email-delivery-failed');
	}
}

/**
 * Mailbox proof for a Google identity whose address Google does not vouch for today. A pending
 * proof is a cookie and a row, never a session. It becomes one only through a mailed code.
 */
export class EmailProofService {
	constructor(private readonly options: EmailProofOptions) {}

	/** True while this Google subject has proven exactly this address recently enough. */
	async proven(actor: Actor): Promise<boolean> {
		const record = await this.options.store.emailLedger.proven(actor.id);
		if (!record || record.expiresAt <= this.options.now()) return false;
		return record.emailHash === (await emailHash(this.options, actor.email));
	}

	async open(actor: Actor): Promise<{ cookie: string; status: EmailProofStatus }> {
		const cookie = randomToken();
		const record: EmailProofRecord = {
			idHash: await this.options.secrets.hash('email-proof', cookie),
			actor,
			codeHash: null,
			codeExpiresAt: null,
			attempts: 0,
			claimed: false,
			expiresAt: this.options.now() + PENDING_TTL
		};
		await this.options.store.emailProofs.create(record);
		return { cookie, status: this.describe(record) };
	}

	async status(cookie: string | null): Promise<EmailProofStatus | null> {
		const pending = await this.pending(cookie);
		return pending ? this.describe(pending.record) : null;
	}

	/** Mails a fresh code, within the send limits. An earlier code stops working. */
	async start(cookie: string | null): Promise<EmailProofStatus> {
		const { store, delivery, now } = this.options;
		if (!delivery) return authFail('email-delivery-disabled');
		const pending = (await this.pending(cookie)) ?? authFail('email-proof-required');
		const { actor } = pending.record;
		if (!(await allowed(this.options, actor))) return authFail('email-rate-limited');
		const code = emailCode();
		const codeExpiresAt = now() + CODE_TTL;
		const codeHash = await this.codeHash(pending.idHash, code);
		const expiresAt = new Date(codeExpiresAt).toISOString();
		await deliver(delivery, { email: actor.email, code, expiresAt });
		const issue = { idHash: pending.idHash, codeHash, codeExpiresAt, now: now() };
		if (!(await store.emailProofs.issue(issue))) return authFail('email-proof-required');
		return { email: actor.email, sent: true, expiresAt };
	}

	/**
	 * One statement spends an attempt and claims the proof. The session is handed out only if
	 * the claimed proof is still there afterwards, so a logout in between always wins.
	 */
	async verify(cookie: string | null, code: string): Promise<IssuedSession> {
		const { store, sessions, now } = this.options;
		const idHash = cookie ? await this.idHash(cookie) : authFail('email-proof-required');
		const codeHash = await this.codeHash(idHash, code);
		const proof = await store.emailProofs.attempt({
			idHash,
			codeHash,
			limit: MAX_ATTEMPTS,
			now: now()
		});
		if (!proof?.claimed) return this.refuse(idHash, proof);
		const origin = { resource: 'projects', parentHash: idHash };
		const issued = await sessions.issue({ kind: 'browser', actor: proof.actor, ...origin });
		if (!(await store.emailProofs.finish(idHash))) {
			await sessions.revoke(issued.record);
			return authFail('email-proof-required');
		}
		const address = await emailHash(this.options, proof.actor.email);
		const proved = { actorId: proof.actor.id, emailHash: address, verifiedAt: now() };
		await store.emailLedger.prove({ ...proved, expiresAt: now() + PROOF_TTL });
		return issued;
	}

	/** Ends the pending proof and any session that was issued from it. */
	async cancel(cookie: string | null): Promise<void> {
		if (!cookie) return;
		const idHash = await this.idHash(cookie);
		await this.options.store.emailProofs.remove(idHash);
		await this.options.sessions.revokeIssuedFrom(idHash);
	}

	private async pending(cookie: string | null): Promise<Pending | null> {
		if (!cookie) return null;
		const idHash = await this.idHash(cookie);
		const record = await this.options.store.emailProofs.find(idHash);
		const live = record !== null && !record.claimed && record.expiresAt > this.options.now();
		return live ? { idHash, record } : null;
	}

	/** A wrong or spent code while the proof lives is one answer; no live proof is another. */
	private async refuse(idHash: string, proof: EmailProofRecord | null): Promise<never> {
		const record = proof ?? (await this.options.store.emailProofs.find(idHash));
		const live = record !== null && !record.claimed && record.expiresAt > this.options.now();
		return authFail(live ? 'email-code-invalid' : 'email-proof-required');
	}

	private describe(record: EmailProofRecord): EmailProofStatus {
		const until = record.codeHash === null ? 0 : (record.codeExpiresAt ?? 0);
		const sent = until > this.options.now();
		const expiresAt = sent ? new Date(until).toISOString() : null;
		return { email: record.actor.email, sent, expiresAt };
	}

	private idHash(cookie: string): Promise<string> {
		return this.options.secrets.hash('email-proof', cookie);
	}

	private codeHash(idHash: string, code: string): Promise<string> {
		return this.options.secrets.hash('email-code', `${idHash}\n${code}`);
	}
}

export type { EmailProofOptions } from './EmailProofService.types';
