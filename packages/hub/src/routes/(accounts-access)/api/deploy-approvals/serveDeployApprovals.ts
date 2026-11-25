import { ZodError } from 'zod';
import {
	approvalDecision,
	approvalClockSkewMs,
	approvalWindowMs,
	deployApprovalPath,
	runnerInput
} from '../../../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type { ApprovalCard } from '../../../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import {
	admitDeployRun,
	DeployApprovalRepository,
	reportDeployRun
} from '../../../../repositories/accounts-access/DeployApprovalRepository';
import type { RunnerScope } from '../../../../repositories/accounts-access/DeployApprovalRepository.types';
import { safeEqual } from '../../../../utils/verification-evidence/authSecrets';
import { readOverviewText } from '../../../api/tracker-overview/trackerOverviewInput';
import { hubHttpFailure } from '../../../api/[...path]/hub-api-controller/hubHttp';
import type {
	DeployApprovalContext,
	DeployApprovalDependencies
} from './serveDeployApprovals.types';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const hidden = () => json({ error: 'not-found' }, 404);
const conflict = () => json({ error: 'approval-unavailable' }, 409);
const body = async (request: Request) =>
	JSON.parse(await readOverviewText(request, 65536)) as unknown;

export async function serveDeployApprovals(request: Request, deps: DeployApprovalDependencies) {
	const context = approvalContext(request, deps);
	if (!context) return hidden();
	try {
		const grant = /^DeployRunner ([\w-]{43})$/.exec(
			request.headers.get('authorization') ?? ''
		)?.[1];
		if (grant && request.method === 'POST')
			return await serveRunner(request, context, { grant, configured: deps.runnerGrants });
		return await serveOwner(request, context, deps.sessions, deps.runnerGrants ?? '{}');
	} catch (cause) {
		return approvalFailure(cause);
	}
}

function approvalFailure(cause: unknown) {
	if (cause instanceof ZodError || cause instanceof SyntaxError)
		return json({ error: 'invalid-input' }, 400);
	const response = hubHttpFailure(cause);
	for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
	return response;
}

function approvalContext(request: Request, { owner, db, now }: DeployApprovalDependencies) {
	const url = new URL(request.url);
	if (
		!owner ||
		!/^google-[\w.-]+$/.test(owner) ||
		!db ||
		url.pathname !== deployApprovalPath ||
		url.search
	)
		return null;
	return { owner, now, db, repository: new DeployApprovalRepository(db) };
}

async function serveOwner(
	request: Request,
	context: DeployApprovalContext,
	sessions: DeployApprovalDependencies['sessions'],
	grants: string
) {
	const session = await sessions?.resolve(request);
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
		grants
	});
	return receipt ? json(receipt) : conflict();
}

async function serveRunner(
	request: Request,
	context: DeployApprovalContext,
	auth: { grant: string; configured?: string }
) {
	const input = runnerInput.parse(await body(request));
	const scope = input.kind === 'register' ? input.card : input;
	const runnerHash = await authorizedRunner(auth, `${scope.project}:${scope.environment}`);
	if (!runnerHash) return hidden();
	const runner = { owner: context.owner, now: context.now, runnerHash };
	if (input.kind === 'collect') return json(await context.repository.collect(input, runner));
	if (input.kind === 'admit')
		return (await admitDeployRun(context.db, input, runner))
			? json({ status: 'admitted' })
			: conflict();
	if (input.kind === 'report')
		return (await reportDeployRun(context.db, input, runner))
			? json({ status: 'recorded' })
			: conflict();
	return registerRun(context, input.card, runner);
}

async function registerRun(
	context: DeployApprovalContext,
	card: ApprovalCard,
	runner: RunnerScope
) {
	if (!validCardScope(card)) return conflict();
	if (
		card.expiresAt <= context.now ||
		card.expiresAt > context.now + approvalWindowMs + approvalClockSkewMs
	)
		return conflict();
	return (await context.repository.register(card, runner))
		? json({ status: 'pending' }, 201)
		: conflict();
}

function validCardScope(card: ApprovalCard) {
	const { control } = card;
	if (!control)
		return card.environment !== 'staging' && card.action !== 'signoff' && Boolean(card.artifact);
	if (card.action === 'signoff') return validSignoffCard(card, control);
	return validControlledRun(card, control);
}

function validSignoffCard(card: ApprovalCard, control: NonNullable<ApprovalCard['control']>) {
	return Boolean(
		card.artifact &&
		control.review &&
		!control.preview &&
		!control.rollbackFrom &&
		control.run !== card.id
	);
}

function validControlledRun(card: ApprovalCard, control: NonNullable<ApprovalCard['control']>) {
	return (
		!control.review &&
		control.run === card.id &&
		Boolean(control.rollbackFrom) === (card.action === 'rollback') &&
		(Boolean(card.artifact) || (card.action === 'rollback' && card.environment === 'staging'))
	);
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
