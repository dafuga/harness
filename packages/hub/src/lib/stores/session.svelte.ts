import type { BrowserAuth } from '../../utils/browserAuth';
import type { AuthStatus } from '../../models/HubAuth.types';

/** Who the server says is signed in. Null while that is not known; the page never assumes. */
class SessionState {
	status = $state<AuthStatus | null>(null);
	error = $state('');
	busy = $state(false);
	constructor(private auth: BrowserAuth) {}
	get actor() {
		return this.status?.actor ?? null;
	}
	/** An address Google does not vouch for, waiting for its code; nobody is signed in meanwhile. */
	get emailProof() {
		return this.actor ? null : (this.status?.emailProof ?? null);
	}
	async refresh() {
		try {
			this.status = await this.auth.status();
		} catch (cause) {
			this.status = null;
			this.error = String(cause);
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
