import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { runnerInput } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type {
	ApprovalCard,
	ApprovalCards
} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import { ScriptedDeployService } from '../../../../../src/services/execution-runtimes/ScriptedDeployService';
import { deployFixture } from '../../../../../test/support/scripted-deploy/fixture';
import { deployApprovalFixture } from '../../support/deployApprovalFixture';
import { ORIGIN, ada } from '../../support/authFixture';

test('staging requires native Go for deploy, signed sign-off and legacy rollback with verified receipts', async () => {
	const cli = await deployFixture();
	const hub = await deployApprovalFixture().catch((error) => {
		cli.dispose();
		throw error;
	});
	try {
		const service = enrolledService(cli, hub.stageKey);
		const authority = controlByOwner(hub);
		const input = { environment: 'staging', release: cli.release } as const;
		await expect(service.deploy(input)).rejects.toThrow(/requires --wait-for-go/);
		const deploy = await service.deploy(input, true);
		expect(deploy.phase).toBe('complete');
		await expect(service.signoff(deploy.plan.id, cli.signoffProof(deploy))).rejects.toThrow(
			/requires sign-off/
		);
		const proof = cli.signoffProof(deploy);
		const signed = await service.signoff(deploy.plan.id, proof, true);
		expect(signed.signoff).toEqual(proof);
		const rollback = await service.deploy(
			{ ...input, release: null, rollback: deploy.plan.id },
			true
		);
		expect(rollback).toMatchObject({
			phase: 'complete',
			result: { observed: { version: 'initial-staging', artifact: null } }
		});
		const cards: ApprovalCards = await (await hub.session()).json();
		expect(cards).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: deploy.plan.id,
					progress: expect.objectContaining({ phase: 'complete', checks: deploy.smoke?.checks })
				}),
				expect.objectContaining({
					action: 'signoff',
					control: expect.objectContaining({ run: deploy.plan.id }),
					progress: { phase: 'signed-off', reference: proof.payload.reference }
				}),
				expect.objectContaining({
					id: rollback.plan.id,
					artifact: null,
					control: { run: rollback.plan.id, rollbackFrom: deploy.plan.id },
					progress: expect.objectContaining({
						phase: 'complete',
						version: 'initial-staging',
						checks: rollback.smoke?.checks
					})
				})
			])
		);
		expect(authority.phases).toEqual([
			'applying',
			'deployed',
			'verified',
			'complete',
			'signed-off',
			'applying',
			'deployed',
			'verified',
			'complete'
		]);
		expect(cli.operations().filter((event) => event === 'apply')).toHaveLength(2);
	} finally {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		cli.dispose();
		await hub.close();
	}
}, 30_000);

test('a dropped provider receipt reconciles without a second apply and revoked authorization prevents the next mutation', async () => {
	const cli = await deployFixture();
	const hub = await deployApprovalFixture().catch((error) => {
		cli.dispose();
		throw error;
	});
	try {
		const authority = controlByOwner(hub);
		const service = enrolledService(cli, hub.stageKey);
		const input = { environment: 'staging', release: cli.release } as const;
		cli.mode('lost-receipt');
		await expect(service.deploy(input, true)).rejects.toThrow(/Deployment broker apply/);
		const id = authority.current!.id;
		expect(service.store.active('fixture', 'staging')).toBe(id);
		expect((await service.resume(id)).phase).toBe('complete');
		cli.mode('normal');
		authority.revokeBeforeAdmission = true;
		await expect(service.deploy({ ...input, release: null, rollback: id }, true)).rejects.toThrow(
			/could not be verified/
		);
		expect(cli.operations().filter((event) => event === 'apply')).toHaveLength(1);
		expect(service.store.active('fixture', 'staging')).toBeNull();
	} finally {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		cli.dispose();
		await hub.close();
	}
}, 30_000);

function enrolledService(cli: Awaited<ReturnType<typeof deployFixture>>, key: string) {
	const keyFile = join(cli.root, 'synthetic-staging-runner.key');
	writeFileSync(keyFile, key, { mode: 0o600 });
	vi.stubEnv('PATH', cli.root + ':' + process.env.PATH);
	return new ScriptedDeployService(
		{
			...cli.registry,
			approvalInbox: {
				origin: ORIGIN,
				owner: ada.id,
				credentials: { 'fixture:staging': keyFile }
			}
		},
		'fixture',
		cli.project
	);
}

function controlByOwner(hub: Awaited<ReturnType<typeof deployApprovalFixture>>) {
	const state = {
		current: undefined as ApprovalCard | undefined,
		revokeBeforeAdmission: false,
		phases: [] as string[]
	};
	const fetchRemote = fetch;
	vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
		if (url !== hub.url) return fetchRemote(url, init);
		const request = new Request(url, init);
		const input = runnerInput.parse(await request.clone().json());
		if (input.kind === 'admit' && state.revokeBeforeAdmission) await hub.revoke();
		const reply = await hub.serve(request);
		if (input.kind === 'register') await ownerDecides(hub, input.card, reply, state);
		if (input.kind === 'report' && reply.ok) state.phases.push(input.progress.phase);
		return reply;
	});
	return state;
}

async function ownerDecides(
	hub: Awaited<ReturnType<typeof deployApprovalFixture>>,
	card: ApprovalCard,
	reply: Response,
	state: { current: ApprovalCard | undefined }
) {
	expect(reply.status).toBe(201);
	const { id, plan, project, environment } = card;
	state.current = card;
	expect(card.control).toBeDefined();
	expect((await hub.session({ id, plan, decision: 'allow' })).status).toBe(200);
	const collect = await hub.runner(
		{ kind: 'collect', id, plan, project, environment },
		hub.stageKey
	);
	expect(await collect.json()).toEqual({ status: 'pending' });
	expect((await hub.session({ id, plan, decision: 'go' })).status).toBe(200);
}
