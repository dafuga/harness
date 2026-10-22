import type { NativeHandoffService } from './native-handoff-service/NativeHandoffService';
import type { RequestSessionService } from './request-session-service/RequestSessionService';
import { authHttp, readJson } from '../../../../utils/verification-evidence/authHttp';
import type { AuthRoutes } from '../../../../utils/verification-evidence/authHttp';
import { AuthRequestValidator } from '../../../../validators/accounts-access/AuthRequestValidator';

export interface NativeHandoffControllerOptions {
	handoff: NativeHandoffService;
	sessions: RequestSessionService;
}

/** `/api/auth/native/*`. Every value arrives in a JSON body; nothing is read from the URL. */
export class NativeHandoffController {
	private readonly input = new AuthRequestValidator();

	constructor(private readonly options: NativeHandoffControllerOptions) {}

	routes(): AuthRoutes {
		return {
			'POST /api/auth/native/start': (request) => this.start(request),
			'POST /api/auth/native/approve': (request) => this.approve(request),
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

	private async poll(request: Request): Promise<Response> {
		const { handoffId } = this.input.nativePoll(await readJson(request));
		return authHttp(await this.options.handoff.poll(handoffId));
	}

	private async exchange(request: Request): Promise<Response> {
		const input = this.input.nativeExchange(await readJson(request));
		return authHttp(await this.options.handoff.exchange(input));
	}
}
