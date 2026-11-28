// @harness-uid u_yz656jlmvp
import type { BrowserAuth } from '../../../utils/accounts-access/browserAuth';
import { BrowserApprovalState } from './browserApproval.svelte';
import type { AuthStatus } from '../../../models/accounts-access/HubAuth.types';

/** Who the server says is signed in. Null while that is not known; the page never assumes. */
class SessionState {
	status = $state<AuthStatus | null>(null);
	error = $state('');
	busy = $state(false);
	readonly deviceApproval = new BrowserApprovalState();
	/** Counts the questions asked; an answer to an earlier one is older than what is shown. */
	private asked = 0;
	/** The newest question, so that a caller who was overtaken can wait for its answer. */
	private newest = { turn: 0, answered: Promise.resolve() };
	constructor(private auth: BrowserAuth) {}
	get identity() {
		return this.status?.actor ?? null;
	}
	get actor() {
		if (this.status?.deviceApproval && this.deviceApproval.result?.state !== 'approved')
			return null;
		return this.identity;
	}
	private setStatus(status: AuthStatus | null) {
		if (
			this.identity?.id !== status?.actor?.id ||
			this.status?.deviceApproval !== status?.deviceApproval
		)
			this.deviceApproval.reset();
		this.status = status;
	}
	checkDevice() {
		const account = this.status?.deviceApproval && this.identity?.id;
		if (account) return this.deviceApproval.check(account);
	}
	deviceRefused() {
		this.deviceApproval.reset();
		void (this.status?.deviceApproval ? this.checkDevice() : this.refresh());
	}
	/** An address Google does not vouch for, waiting for its code; nobody is signed in meanwhile. */
	get emailProof() {
		return this.identity ? null : (this.status?.emailProof ?? null);
	}
	refresh() {
		return this.ask((turn) => this.readAfresh(turn));
	}
	private async readAfresh(turn: number) {
		try {
			const status = await this.auth.status();
			if (turn === this.asked) this.setStatus(status);
		} catch (cause) {
			if (turn !== this.asked) return;
			this.setStatus(null);
			this.error = String(cause);
		}
	}
	/**
	 * Asks again while the page is open. Only an answer changes who is shown as signed in: one
	 * that cannot be read now leaves the last answer, and the next focus or interval asks again.
	 * The same answer keeps its object, so nothing that shows it is rendered or asked again.
	 */
	check() {
		return this.ask((turn) => this.readAgain(turn));
	}
	/** Resolves only once no newer question is waiting, so the caller sees the current account. */
	private ask(read: (turn: number) => Promise<void>): Promise<void> {
		const turn = ++this.asked;
		const answered = read(turn).then(() =>
			this.newest.turn > turn ? this.newest.answered : undefined
		);
		this.newest = { turn, answered };
		return answered;
	}
	private async readAgain(turn: number) {
		try {
			const status = await this.auth.status();
			if (turn !== this.asked || JSON.stringify(status) === JSON.stringify(this.status)) return;
			this.setStatus(status);
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
		await this.change(async () => {
			const account = this.status?.deviceApproval && this.identity?.id;
			if (account) await this.deviceApproval.forget(account);
			await this.auth.logout();
		});
	}
	async sendEmailCode() {
		await this.change(() => this.auth.emailStart());
	}
	/** True only when the server then names a signed-in person. */
	async verifyEmail(code: string) {
		await this.change(() => this.auth.emailVerify(code));
		return this.identity !== null;
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

export type { Session } from './session.svelte.types';
export type { SessionState };
