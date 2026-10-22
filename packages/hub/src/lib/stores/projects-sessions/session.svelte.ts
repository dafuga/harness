import type { BrowserAuth } from '../../../utils/accounts-access/browserAuth';
import type { AuthStatus } from '../../../models/accounts-access/HubAuth.types';

/** Who the server says is signed in. Null while that is not known; the page never assumes. */
class SessionState {
	status = $state<AuthStatus | null>(null);
	error = $state('');
	busy = $state(false);
	/** Counts the questions asked; an answer to an earlier one is older than what is shown. */
	private asked = 0;
	constructor(private auth: BrowserAuth) {}
	get actor() {
		return this.status?.actor ?? null;
	}
	/** An address Google does not vouch for, waiting for its code; nobody is signed in meanwhile. */
	get emailProof() {
		return this.actor ? null : (this.status?.emailProof ?? null);
	}
	async refresh() {
		const turn = ++this.asked;
		try {
			const status = await this.auth.status();
			if (turn === this.asked) this.status = status;
		} catch (cause) {
			if (turn !== this.asked) return;
			this.status = null;
			this.error = String(cause);
		}
	}
	/**
	 * Asks again while the page is open. Only an answer changes who is shown as signed in: one
	 * that cannot be read now leaves the last answer, and the next focus or interval asks again.
	 * The same answer keeps its object, so nothing that shows it is rendered or asked again.
	 */
	async check() {
		const turn = ++this.asked;
		try {
			const status = await this.auth.status();
			if (turn !== this.asked || JSON.stringify(status) === JSON.stringify(this.status)) return;
			this.status = status;
		} catch {
			/* Reported by the read that needs the session; this one is asked again. */
		}
	}
	challenge() {
		return this.auth.challenge();
	}
	async signIn(credential: string, csrf: string) {
		await this.change(() => this.auth.google(credential, csrf));
	}
	async signOut() {
		await this.change(() => this.auth.logout());
	}
	async sendEmailCode() {
		await this.change(() => this.auth.emailStart());
	}
	/** True only when the server then names a signed-in person. */
	async verifyEmail(code: string) {
		await this.change(() => this.auth.emailVerify(code));
		return this.actor !== null;
	}
	/** After a change the status is read again: only the server's answer signs anyone in or out. */
	private async change(action: () => Promise<unknown>) {
		/** A status asked for before the change cannot answer for after it. */
		this.asked++;
		this.busy = true;
		this.error = '';
		try {
			await action();
		} catch (cause) {
			this.error = String(cause);
		} finally {
			await this.refresh();
			this.busy = false;
		}
	}
}
export function createSessionStore(auth: BrowserAuth) {
	return new SessionState(auth);
}
export type Session = SessionState;
