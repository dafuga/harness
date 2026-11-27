import { SealedError } from '../../../models/networking-security/SealedError';
import type {
	SealedChainEntry,
	SealedGrant
} from '../../../models/networking-security/Sealed.types';
import { sealedChain } from '../../../utils/networking-security/sealedChain';
import type {
	EnrollmentMailbox,
	EnrollmentReviewOptions,
	MailboxStep
} from '../SealedEnrollmentReviewService.types';

export class ReviewTransport {
	constructor(
		private readonly options: EnrollmentReviewOptions,
		private readonly id: string
	) {
		if (!/^[0-9a-f]{32}$/.test(id) || id.length !== 32)
			throw new SealedError('Invalid approval request.');
	}

	async call<T>(path: string, body?: unknown): Promise<T> {
		const { device, signal, request } = this.options;
		signal.throwIfAborted();
		const response = await request('/api/sync/v1/' + path, {
			signal,
			redirect: 'error',
			cache: 'no-store',
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'X-Harness-Device': device.deviceId, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (!response.ok) throw new SealedError('The Hub could not complete the enrollment request.');
		const result = await response.json();
		signal.throwIfAborted();
		return result as T;
	}

	async mailbox(): Promise<MailboxStep[]> {
		const view = await this.call<EnrollmentMailbox>('enroll/' + this.id);
		if (
			view.id !== this.id ||
			!Array.isArray(view.steps) ||
			view.steps.length < 1 ||
			view.steps.length > 4 ||
			view.steps.some(
				(step, n) => step?.n !== n || typeof step.by !== 'string' || typeof step.body !== 'string'
			)
		)
			throw new SealedError('Invalid enrollment mailbox.');
		return view.steps;
	}

	async append(n: number, fields: Record<string, string>): Promise<void> {
		const step = await this.call<MailboxStep>('enroll/' + this.id, fields);
		if (step.n !== n || step.by !== this.options.device.deviceId || !stepMatches(step, fields))
			throw new SealedError('The Hub did not acknowledge this enrollment step.');
	}

	async chain() {
		const entries: SealedChainEntry[] = [];
		for (;;) {
			const page = await this.call<{ entries: SealedChainEntry[]; more: boolean }>(
				'chain?after=' + (entries.length - 1)
			);
			if (
				!Array.isArray(page.entries) ||
				entries.length + page.entries.length > 2048 ||
				typeof page.more !== 'boolean'
			)
				throw new SealedError('Invalid device history.');
			entries.push(...page.entries);
			if (!page.more)
				return sealedChain(entries, { account: this.options.account, pin: this.options.pin });
			if (!page.entries.length || entries.length === 2048)
				throw new SealedError('Incomplete device history.');
		}
	}

	async grants(): Promise<SealedGrant[]> {
		const result = await this.call<{ grants: SealedGrant[] }>(
			'grants?device=' + this.options.device.deviceId
		);
		if (!Array.isArray(result.grants)) throw new SealedError('Invalid device grants.');
		return result.grants;
	}
}

export function stepMatches(step: MailboxStep, fields: Record<string, string>): boolean {
	const value = JSON.parse(step.body);
	return (
		!!value &&
		Object.keys(value).length === Object.keys(fields).length &&
		Object.entries(fields).every(([key, expected]) => value[key] === expected)
	);
}
