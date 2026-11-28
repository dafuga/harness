// @harness-uid u_eltmiglca4
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import {
	vaultPurchaseRoutes,
	vaultPurchaseProof
} from '../../validators/accounts-access/VaultPaymentValidator';
import {
	VaultWireValidator,
	vaultChallenge,
	vaultLeaseCall,
	vaultLeaseIssue,
	vaultProof,
	vaultSessionRequest,
	vaultTicket
} from '../../validators/accounts-access/VaultWireValidator';
import type {
	VaultBrokerRoute as Route,
	VaultBrokerServerConfig
} from './VaultBrokerServerAdapter.types';

const maxBody = 400 * 1024;

/**
 * The broker's local endpoint: JSON over a Unix socket in an owner-only directory. Session
 * routes carry the kernel-verified peer user into every call; device routes carry phone proofs.
 */
export class VaultBrokerServerAdapter {
	private readonly wire = new VaultWireValidator();
	private readonly routes: Record<string, Route>;
	private server: Server | null = null;

	constructor(private readonly config: VaultBrokerServerConfig) {
		const { broker, keeper, devices, payments } = config;
		const route = <T>(schema: z.ZodType<T>, run: (body: T, uid: number | null) => unknown) =>
			({ schema, run }) as Route;
		this.routes = {
			'/v1/session/requests': route(vaultSessionRequest, (body, uid) => broker.create(body, uid)),
			'/v1/session/status': route(vaultTicket, (body, uid) => ({
				status: broker.status(body, uid)
			})),
			'/v1/session/claim': route(vaultTicket, (body, uid) => broker.claim(body, uid)),
			'/v1/session/cancel': route(vaultTicket, (body, uid) => ({
				status: broker.cancel(body, uid)
			})),
			'/v1/session/lease': route(vaultLeaseIssue, ({ teardown, ...ticket }, uid) =>
				keeper.issue(ticket, uid, teardown)
			),
			'/v1/session/attach': route(vaultLeaseCall, (body, uid) =>
				keeper.attach(body.lease, body.session, uid)
			),
			'/v1/session/finish': route(vaultLeaseCall, (body, uid) =>
				keeper.finish(body.lease, body.session, uid)
			),
			'/v1/device/challenge': route(vaultChallenge, (body) => devices.issue(body.deviceId)),
			'/v1/device/requests': route(vaultProof, (body) => broker.queue(body)),
			'/v1/device/decision': route(vaultProof, (body) => ({ status: broker.decide(body) }))
		};
		if (payments) {
			this.routes[vaultPurchaseRoutes.queue] = route(vaultPurchaseProof, (body) =>
				payments.queue(body)
			);
			this.routes[vaultPurchaseRoutes.decision] = route(vaultPurchaseProof, (body) => ({
				status: payments.decide(body)
			}));
		}
	}

	async listen(): Promise<string> {
		const { socketPath } = this.config;
		mkdirSync(dirname(socketPath), { recursive: true, mode: 0o700 });
		chmodSync(dirname(socketPath), 0o700);
		rmSync(socketPath, { force: true });
		const server = createServer(
			{ requestTimeout: 7_000, headersTimeout: 5_000 },
			(request, response) => {
				void this.handle(request, response);
			}
		);
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(socketPath, () => resolve());
		});
		chmodSync(socketPath, 0o600);
		this.server = server;
		return socketPath;
	}

	async close(): Promise<void> {
		const server = this.server;
		this.server = null;
		if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
		rmSync(this.config.socketPath, { force: true });
	}

	private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
		try {
			const route = this.routes[request.url ?? ''];
			if (!route || request.method !== 'POST') throw new VaultBrokerError(404, 'Unknown route.');
			if (request.headers['content-type'] !== 'application/json') {
				throw new VaultBrokerError(415, 'Expected an application/json request.');
			}
			const uid = this.config.peerUid?.(request.socket) ?? null;
			const body = this.wire.json(route.schema, await this.read(request), 'request');
			this.send(response, 200, route.run(body as never, uid));
		} catch (error) {
			const known = error instanceof VaultBrokerError;
			this.send(response, known ? error.status : 500, {
				error: known ? error.message : 'Broker error.'
			});
		}
	}

	private async read(request: IncomingMessage): Promise<Buffer> {
		const chunks: Buffer[] = [];
		let length = 0;
		for await (const chunk of request as AsyncIterable<Buffer>) {
			length += chunk.length;
			if (length > maxBody) throw new VaultBrokerError(413, 'Request is too large.');
			chunks.push(chunk);
		}
		return Buffer.concat(chunks, length);
	}

	private send(response: ServerResponse, status: number, value: unknown): void {
		const text = JSON.stringify(value);
		const headers = {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store'
		};
		response.writeHead(status, { ...headers, 'Content-Length': Buffer.byteLength(text) });
		response.end(text);
	}
}

export type { VaultBrokerServerConfig } from './VaultBrokerServerAdapter.types';
