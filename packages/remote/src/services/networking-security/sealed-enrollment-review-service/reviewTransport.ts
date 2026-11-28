// @harness-uid u_fbbrnjjwm4
import { SealedError } from '../../../models/networking-security/SealedError';
import type {
	SealedChainEntry,
	SealedGrant
} from '../../../models/networking-security/Sealed.types';
import { sealedChain } from '../../../utils/networking-security/sealedChain';
import type {
	EnrollmentWrite,
	EnrollmentMailbox,
	EnrollmentReviewOptions,
	EnrollmentTransportOptions,
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

	async mailbox(): Promise<MailboxStep[]> {
		const view = await readEnrollment<EnrollmentMailbox>(this.options, 'enroll/' + this.id);
		if (view.denied === true) throw new SealedError('The device approval was denied.');
		assertMailbox(view, this.id);
		return view.steps;
	}

	async deny(): Promise<void> {
		const response = await readEnrollment<{ denied: boolean }>(this.options, 'enroll/' + this.id, {
			deny: true
		});
		if (response.denied !== true) throw new SealedError('The Hub did not confirm denial.');
	}

	publish(entry: SealedChainEntry, grants: SealedGrant[]) {
		return readEnrollment<{ seq: number; hash: string }>(this.options, 'devices', {
			entries: [entry],
			grants,
			enrollment: this.id
		});
	}

	async append(n: number, fields: Record<string, string>): Promise<void> {
		const step = await readEnrollment<MailboxStep>(this.options, 'enroll/' + this.id, fields);
		if (step.n !== n || step.by !== this.options.device.deviceId || !stepMatches(step, fields))
			throw new SealedError('The Hub did not acknowledge this enrollment step.');
	}

	async chain() {
		const entries = await enrollmentEntries(this.options);
		return sealedChain(entries, { account: this.options.account, pin: this.options.pin });
	}

	grants(): Promise<SealedGrant[]> {
		return enrollmentGrants(this.options);
	}
}

export async function sendEnrollment(
	options: EnrollmentTransportOptions,
	path: string,
	body?: EnrollmentWrite
): Promise<Response> {
	const { device, signal, request } = options;
	signal.throwIfAborted();
	return request('/api/sync/v1/' + path, {
		signal,
		redirect: 'error',
		cache: 'no-store',
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'X-Harness-Device': device.deviceId, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

export async function enrollmentResponse<T>(response: Response, signal: AbortSignal): Promise<T> {
	if (!response.ok) {
		await response.body?.cancel();
		throw new SealedError('The Hub could not complete the enrollment request.');
	}
	const result: unknown = await response.json();
	signal.throwIfAborted();
	if (!result || typeof result !== 'object' || Array.isArray(result))
		throw new SealedError('The Hub returned an invalid enrollment response.');
	return result as T;
}

export async function readEnrollment<T>(
	options: EnrollmentTransportOptions,
	path: string,
	body?: EnrollmentWrite
): Promise<T> {
	return enrollmentResponse(await sendEnrollment(options, path, body), options.signal);
}

export function assertMailbox(view: EnrollmentMailbox, expected?: string): void {
	if (
		typeof view.id !== 'string' ||
		!/^[0-9a-f]{32}$/.test(view.id) ||
		(expected !== undefined && view.id !== expected) ||
		!Array.isArray(view.steps) ||
		view.steps.length < 1 ||
		view.steps.length > 4 ||
		view.steps.some(
			(step, n) => step?.n !== n || typeof step.by !== 'string' || typeof step.body !== 'string'
		)
	)
		throw new SealedError('Invalid enrollment mailbox.');
}

export async function enrollmentEntries(
	options: EnrollmentTransportOptions
): Promise<SealedChainEntry[]> {
	const entries: SealedChainEntry[] = [];
	for (;;) {
		const page = await readEnrollment<{ entries: SealedChainEntry[]; more: boolean }>(
			options,
			'chain?after=' + (entries.length - 1)
		);
		if (
			!Array.isArray(page.entries) ||
			entries.length + page.entries.length > 2048 ||
			typeof page.more !== 'boolean'
		)
			throw new SealedError('Invalid device history.');
		entries.push(...page.entries);
		if (!page.more) return entries;
		if (!page.entries.length || entries.length === 2048)
			throw new SealedError('Incomplete device history.');
	}
}

export async function enrollmentGrants(
	options: EnrollmentTransportOptions
): Promise<SealedGrant[]> {
	const result = await readEnrollment<{ grants: SealedGrant[] }>(
		options,
		'grants?device=' + options.device.deviceId
	);
	if (!Array.isArray(result.grants)) throw new SealedError('Invalid device grants.');
	return result.grants;
}

export function stepMatches(step: MailboxStep, fields: Record<string, string>): boolean {
	const value = JSON.parse(step.body);
	return (
		!!value &&
		Object.keys(value).length === Object.keys(fields).length &&
		Object.entries(fields).every(([key, expected]) => value[key] === expected)
	);
}
