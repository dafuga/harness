import type {
	AuthEnv,
	EmailProofDelivery,
	EmailProofMessage
} from '../../../../models/accounts-access/HubAuth.types';
import { authFail } from '../../../../utils/accounts-access/authFail';
import { boundedText } from '../../../../utils/verification-evidence/authHttp';

export interface ResendEmailAdapterConfig {
	apiKey: string;
	from: string;
	fetch: typeof fetch;
}

const ENDPOINT = 'https://api.resend.com/emails';
const SUBJECT = 'Your Harness verification code';
const TIMEOUT = 10_000;
const MAX_RESPONSE = 4096;
const API_KEY = /^[A-Za-z0-9_-]{8,200}$/;
const ADDRESS = '[^\\s<>@"]{1,64}@[^\\s<>@"]{1,255}';
const FROM = new RegExp(`^(?:${ADDRESS}|[^\\r\\n<>"]{1,80} <${ADDRESS}>)$`);

/** Plain text and no link: the code is typed into the page the person already has open. */
function text(message: EmailProofMessage): string {
	const lines = [
		`Your Harness verification code is ${message.code}.`,
		'',
		'It expires in 10 minutes. If you did not try to sign in to Harness, ignore this message.'
	];
	return lines.join('\n');
}

/** Sent means the documented success: a 2xx whose small JSON body carries a string `id`. */
async function accepted(response: Response): Promise<boolean> {
	if (response.status < 200 || response.status >= 300) {
		await response.body?.cancel().catch(() => undefined);
		return false;
	}
	try {
		const body: unknown = JSON.parse((await boundedText(response.body, MAX_RESPONSE)) ?? '');
		return typeof (body as { id?: unknown } | null)?.id === 'string';
	} catch {
		return false;
	}
}

/**
 * Email delivery through Resend's send-email API. The host is fixed, a redirect is never
 * followed, the response is read up to a small bound, and no provider text leaves this class.
 */
export class ResendEmailAdapter implements EmailProofDelivery {
	constructor(private readonly config: ResendEmailAdapterConfig) {}

	async send(message: EmailProofMessage): Promise<void> {
		const response = await this.post(message);
		if (!(await accepted(response))) return authFail('email-delivery-failed');
	}

	private async post(message: EmailProofMessage): Promise<Response> {
		const { apiKey, from } = this.config;
		const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
		const content = { from, to: [message.email], subject: SUBJECT, text: text(message) };
		const init = { method: 'POST', headers, body: JSON.stringify(content) };
		try {
			// `manual`, not `error`: Cloudflare Workers throw on `error`. A 3xx is then not a 2xx.
			const signal = AbortSignal.timeout(TIMEOUT);
			return await this.config.fetch(ENDPOINT, { ...init, redirect: 'manual', signal });
		} catch {
			return authFail('email-delivery-failed');
		}
	}
}

/** Null unless both settings are present and well formed. There is no fallback sender. */
export function createResendDelivery(
	env: AuthEnv,
	fetcher: typeof fetch = (input, init) => fetch(input, init)
): EmailProofDelivery | null {
	const apiKey = env.HARNESS_EMAIL_API_KEY ?? '';
	const from = env.HARNESS_EMAIL_FROM ?? '';
	if (!API_KEY.test(apiKey) || !FROM.test(from)) return null;
	return new ResendEmailAdapter({ apiKey, from, fetch: fetcher });
}
