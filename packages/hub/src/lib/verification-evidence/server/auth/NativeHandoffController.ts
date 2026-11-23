// @harness-uid u_4oll3wtumi
import type { NativeHandoffControllerOptions } from './NativeHandoffController.types';
import { authHttp, readJson } from '../../../../utils/verification-evidence/authHttp';
import { authFail } from '../../../../utils/accounts-access/authFail';
import type { AuthRoutes } from '../../../../utils/verification-evidence/authHttp';
import { AuthRequestValidator } from '../../../../validators/accounts-access/AuthRequestValidator';

/** Browser-authorized native sign-in, device administration and typed-code recovery. */
export class NativeHandoffController {
	private readonly input = new AuthRequestValidator();

	constructor(private readonly options: NativeHandoffControllerOptions) {}

	routes(): AuthRoutes {
		return {
			'POST /api/auth/native/start': (request) => this.start(request),
			'POST /api/auth/native/approve': (request) => this.approve(request),
			'POST /api/auth/native/return': (request) => this.authorizeBrowser(request),
			'GET /api/auth/native/devices': (request) => this.devices(request),
			'POST /api/auth/native/devices': (request) => this.removeDevice(request),
			'POST /api/auth/native/poll': (request) => this.poll(request),
			'POST /api/auth/native/exchange': (request) => this.exchange(request)
		};
	}

	private async start(request: Request): Promise<Response> {
		const input = this.input.nativeStart(await readJson(request));
		return authHttp(await this.options.handoff.start(input));
	}

	/** Only a person's own browser session may approve; a native session cannot chain. */
	private async approve(request: Request): Promise<Response> {
		const session = await this.options.sessions.browser(request);
		const input = this.input.nativeApprove(await readJson(request));
		return authHttp(await this.options.handoff.approve(session, input));
	}

	private async authorizeBrowser(request: Request): Promise<Response> {
		const session = await this.options.sessions.browser(request);
		const { handoffId } = this.input.nativePoll(await readJson(request));
		return authHttp(await this.options.handoff.authorizeBrowser(session, handoffId));
	}

	private async devices(request: Request): Promise<Response> {
		const session = await this.options.sessions.browser(request);
		return authHttp({ devices: await this.options.repository.devices(session.actor.id) });
	}

	private async removeDevice(request: Request): Promise<Response> {
		const session = await this.options.sessions.browser(request);
		const id = this.input.deviceId(await readJson(request));
		if (!(await this.options.repository.removeDevice(session.actor.id, id)))
			return authFail('not-found');
		return authHttp({ ok: true });
	}

	private async poll(request: Request): Promise<Response> {
		const { handoffId } = this.input.nativePoll(await readJson(request));
		return authHttp(await this.options.handoff.poll(handoffId));
	}

	private async exchange(request: Request): Promise<Response> {
		const input = this.input.nativeExchange(await readJson(request));
		return authHttp(await this.options.handoff.exchange(input));
	}
}

export type { NativeHandoffControllerOptions } from './NativeHandoffController.types';
