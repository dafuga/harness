import { ZodError } from 'zod';
import {
	approvalDecision,
	approvalClockSkewMs,
	approvalWindowMs,
	deployApprovalPath,
	runnerInput
} from '../../../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import { DeployApprovalRepository } from '../../../../repositories/accounts-access/DeployApprovalRepository';
import { safeEqual } from '../../../../utils/verification-evidence/authSecrets';
import { readOverviewText } from '../../../api/tracker-overview/trackerOverviewInput';
import { hubHttpFailure } from '../../../api/[...path]/hub-api-controller/hubHttp';
import type { DeployApprovalDependencies } from './serveDeployApprovals.types';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const hidden = () => json({ error: 'not-found' }, 404);
const conflict = () => json({ error: 'approval-unavailable' }, 409);
const body = async (request: Request) =>
	JSON.parse(await readOverviewText(request, 65536)) as unknown;

export async function serveDeployApprovals(request: Request, deps: DeployApprovalDependencies) {
	const url = new URL(request.url);
	if (
		!deps.owner ||
		!/^google-[\w.-]+$/.test(deps.owner) ||
		!deps.db ||
		url.pathname !== deployApprovalPath ||
		url.search
	)
		return hidden();
	const context = {
		owner: deps.owner,
		now: deps.now,
		repository: new DeployApprovalRepository(deps.db)
	};
	try {
		const grant = /^DeployRunner ([\w-]{43})$/.exec(
			request.headers.get('authorization') ?? ''
		)?.[1];
		if (grant && request.method === 'POST')
			return await serveRunner(request, context, { grant, configured: deps.runnerGrants });
		const session = await deps.sessions?.resolve(request);
		if (
			session?.kind !== 'native' ||
			session.resource !== 'projects' ||
			session.actor.id !== context.owner ||
			!session.actor.emailVerified
		)
			return hidden();
		if (request.method === 'GET')
			return json(await context.repository.list(context.owner, context.now));
		if (request.method !== 'POST') return hidden();
		const receipt = await context.repository.decide(approvalDecision.parse(await body(request)), {
			owner: context.owner,
			now: context.now,
			sessionHash: session.idHash,
			grants: deps.runnerGrants ?? '{}'
		});
		return receipt ? json(receipt) : conflict();
	} catch (cause) {
		if (cause instanceof ZodError || cause instanceof SyntaxError)
			return json({ error: 'invalid-input' }, 400);
		const response = hubHttpFailure(cause);
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
		return response;
	}
}

async function serveRunner(
	request: Request,
	context: { owner: string; now: number; repository: DeployApprovalRepository },
	auth: { grant: string; configured?: string }
) {
	const input = runnerInput.parse(await body(request));
	const scope = input.kind === 'register' ? input.card : input;
	const runnerHash = await authorizedRunner(auth, `${scope.project}:${scope.environment}`);
	if (!runnerHash) return hidden();
	if (input.kind === 'collect')
		return json(await context.repository.collect(input, { ...context, runnerHash }));
	const { card } = input;
	if (
		card.expiresAt <= context.now ||
		card.expiresAt > context.now + approvalWindowMs + approvalClockSkewMs
	)
		return conflict();
	return (await context.repository.register(card, { ...context, runnerHash }))
		? json({ status: 'pending' }, 201)
		: conflict();
}

async function authorizedRunner(
	{ grant, configured }: { grant: string; configured?: string },
	scope: string
): Promise<string | undefined> {
	const expected = JSON.parse(configured ?? '{}')?.[scope];
	if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) return;
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(grant));
	const actual = [...new Uint8Array(hash)]
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('');
	if (safeEqual(expected, actual)) return actual;
}
