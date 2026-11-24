// @harness-uid u_pkn44eqxgd
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import {
	approvalReceipt,
	approvalClockSkewMs,
	approvalWindowMs,
	deployApprovalPath
} from '../../../core/execution-runtimes/scripted-deploy/approvalInbox';
import type {
	ApprovalCard,
	ApprovalReceipt
} from '../../../core/execution-runtimes/scripted-deploy/approvalInbox.types';
import { privateFile } from '../../../validators/execution-runtimes/DeployManifestValidator';
import type { InboxConfig, RunnerScope } from './DeployApprovalClient.types';

const answer = z.discriminatedUnion('status', [
	z.strictObject({ status: z.literal('pending') }),
	z.strictObject({ status: z.literal('refused') }),
	z.strictObject({ status: z.literal('allowed'), receipt: approvalReceipt })
]);

export class DeployApprovalClient {
	constructor(private readonly config: InboxConfig) {}

	async wait(card: ApprovalCard): Promise<ApprovalReceipt> {
		const key = this.runnerKey(card);
		const opened = await this.request({ kind: 'register', card }, key);
		if (opened.status !== 'pending') throw refused();
		const { id, plan, project, environment } = card;
		const request = { kind: 'collect', id, plan, project, environment };
		while (Date.now() < card.expiresAt) {
			const attempt = await this.request(request, key);
			if (attempt.status === 'refused') throw refused();
			if (attempt.status === 'allowed') return this.validate(card, attempt.receipt);
			await delay(1000);
		}
		throw refused();
	}

	private validate(card: ApprovalCard, receipt: ApprovalReceipt): ApprovalReceipt {
		if (
			receipt.actor !== this.config.owner ||
			receipt.id !== card.id ||
			receipt.plan !== card.plan ||
			receipt.decision !== 'allow' ||
			receipt.decidedAt < card.expiresAt - approvalWindowMs - approvalClockSkewMs ||
			receipt.decidedAt >= card.expiresAt ||
			Date.now() >= card.expiresAt
		)
			throw refused();
		return receipt;
	}

	private runnerKey({ project, environment }: RunnerScope): string {
		try {
			const path = this.config.credentials[project + ':' + environment];
			if (!path) throw refused();
			const key = readFileSync(privateFile(path), 'utf8').trim();
			if (/^[\w-]{43}$/.test(key)) return key;
		} catch {
			throw refused();
		}
		throw refused();
	}

	private async request(body: unknown, key: string) {
		try {
			const reply = await fetch(this.config.origin + deployApprovalPath, {
				method: 'POST',
				headers: { authorization: 'DeployRunner ' + key, 'content-type': 'application/json' },
				body: JSON.stringify(body),
				redirect: 'error',
				signal: AbortSignal.timeout(8000)
			});
			if (reply.ok) return answer.parse(await reply.json());
		} catch {
			throw refused();
		}
		throw refused();
	}
}

function refused(): ExpectedCliError {
	return new ExpectedCliError(
		'Exact deploy approval was denied, expired, or could not be verified.'
	);
}
