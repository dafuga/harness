import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import {
	hash,
	type Journal
} from '../../../../../src/core/execution-runtimes/scripted-deploy/contracts';
import { runnerInput } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type { ApprovalReceipt } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import { ScriptedDeployService } from '../../../../../src/services/execution-runtimes/ScriptedDeployService';
import { deployFixture } from '../../../../../test/support/scripted-deploy/fixture';
import { deployApprovalFixture } from '../../support/deployApprovalFixture';
import { ORIGIN, ada } from '../../support/authFixture';

const refusals = {
	generic: /could not be verified/,
	'ignore-decision': /match a current exact decision/,
	'changed-after-grant': /changed after planning/
};

test('the scripted runner applies only the matching owner receipt and rejects a Tracker answer, unmatched signature, drift and replay', async () => {
	const cli = await deployFixture();
	const hub = await deployApprovalFixture().catch((error) => {
		cli.dispose();
		throw error;
	});
	try {
		const stage = cli.review(cli.promote('staging'));
		const service = fixtureService(cli, hub.key);
		const authority = scriptedAuthority(hub, stage);
		const promote = () =>
			service.deploy({ environment: 'preprod', release: cli.release, from: stage.plan.id });
		for (const [mode, expected] of Object.entries(refusals)) {
			authority.mode = mode;
			cli.mode(mode);
			await expect(promote()).rejects.toThrow(expected);
			if (mode === 'generic') hub.advance(-310_000);
			expect(cli.operations().filter((event) => event === 'apply')).toHaveLength(1);
		}
		authority.mode = 'normal';
		cli.mode('normal');
		const deployed = await promote();
		expect(deployed.phase).toBe('complete');
		expect(deployed.result?.observed.artifact).toBe(cli.release.artifact);
		expect(deployed.approval?.payload).toMatchObject({
			issuer: 'daniel',
			scope: hash(deployed.plan),
			reference: 'decision:' + authority.receipt?.receipt
		});
		authority.mode = 'replay';
		await expect(promote()).rejects.toThrow(/could not be verified/);
		expect(cli.operations().filter((event) => event === 'apply')).toHaveLength(2);
	} finally {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		cli.dispose();
		await hub.close();
	}
}, 35_000);

function fixtureService(cli: Awaited<ReturnType<typeof deployFixture>>, key: string) {
	const keyFile = join(cli.root, 'synthetic-runner.key');
	writeFileSync(keyFile, key, { mode: 0o600 });
	vi.stubEnv('PATH', cli.root + ':' + process.env.PATH);
	return new ScriptedDeployService(
		{
			...cli.registry,
			approvalInbox: { origin: ORIGIN, owner: ada.id, credentials: { 'fixture:preprod': keyFile } }
		},
		'fixture',
		cli.project
	);
}

function scriptedAuthority(hub: Awaited<ReturnType<typeof deployApprovalFixture>>, stage: Journal) {
	const state = { mode: 'generic', receipt: undefined as ApprovalReceipt | undefined };
	let sawPending = false;
	const fetchRemote = fetch;
	vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
		if (url !== hub.url) return fetchRemote(url, init);
		const request = new Request(url, init);
		const input = runnerInput.parse(await request.clone().json());
		if (state.mode === 'replay')
			return Response.json(
				input.kind === 'register'
					? { status: 'pending' }
					: { status: 'allowed', receipt: state.receipt }
			);
		const reply = await hub.serve(request);
		if (input.kind === 'collect' && state.mode === 'generic' && !sawPending) {
			expect(await reply.clone().json()).toEqual({ status: 'pending' });
			expect(
				(await hub.session({ item: 'fixture-item', answer: 'Approve this deploy' })).status
			).toBe(400);
			sawPending = true;
			hub.advance(310_000);
		}
		if (input.kind === 'register') {
			expect(reply.status).toBe(201);
			expect(input.card).toMatchObject({
				artifact: stage.plan.release!.artifact,
				release: stage.plan.release!.id,
				predecessor: {
					id: stage.plan.id,
					signoff: hash(stage.signoff!),
					smoke: stage.smoke!.checks
				}
			});
			if (state.mode === 'generic') return reply;
			const accepted = await hub.session({
				id: input.card.id,
				plan: input.card.plan,
				decision: 'allow'
			});
			expect(accepted.status).toBe(200);
			state.receipt = await accepted.json();
		}
		return reply;
	});
	return state;
}
