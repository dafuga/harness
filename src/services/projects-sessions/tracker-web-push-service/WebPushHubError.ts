// @harness-uid u_ovui74xdee
/** The Hub refused the sender or failed. The status is all that is kept of its answer. */
export class WebPushHubError extends Error {
	constructor(readonly status: number) {
		super(`Hub answered ${status}`);
		this.name = 'WebPushHubError';
	}
}
