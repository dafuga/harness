// @harness-uid u_c37vr4cyvl
import type { DeviceOperationsOptions, Fields, Operation } from './DeviceOperationsService.types';
import {
	RemoteFailure,
	RemoteInputValidator,
	agentMethods,
	attachMethod,
	commentMethods,
	readMethods,
	revisionMethods
} from '../../../../../../../remote/src/index';
import type { RemoteMethod, WireRequest } from '../../../../../../../remote/src/index';
import type { ProjectSnapshot } from '../../../../../models/development-tooling/Desktop.types';
import { channels } from '../../../../../models/development-tooling/DesktopBridge.types';
import type { EvidenceArtifactResult as Artifact } from '../../../../../models/verification-evidence/DesktopEvidence.types';
import { binaryAnswer } from '../../../../../utils/reports-media/binaryAnswer';
import { deviceCapabilities } from './deviceCapabilities';
import { gitRead } from '../../../../../utils/projects-sessions/gitRead';
import { IpcRequestValidator } from '../../../../../validators/development-tooling/IpcRequestValidator';
import type { ClientProject } from '../ClientProjectsService';

function ancestor(root: string, commit: string, tip: string): Promise<boolean> {
	return gitRead(root, ['merge-base', '--is-ancestor', commit, tip]).then(
		() => true,
		() => false
	);
}

function trackerCalls(
	options: DeviceOperationsOptions
): Partial<Record<RemoteMethod, (input: Fields) => Promise<unknown>>> {
	const { home, homeChat, homeDocument, trackerPull, trackerPush } = options;
	return {
		homeSnapshot: home,
		homeDocument,
		homeChat:
			homeChat &&
			((input) => {
				// The wire's epoch authenticates the mutation, but is not part of the message.
				const message = { ...input };
				delete message.epoch;
				return homeChat(message);
			}),
		trackerReplicaPull: trackerPull,
		trackerReplicaPush: trackerPush
	};
}

/**
 * What an approved phone may ask of this computer: its granted local projects, by explicit id
 * and revision. No folder, no hosted credential, no path, and nothing outside the bridge.
 */
export class DeviceOperationsService {
	private readonly inputs = new RemoteInputValidator();
	private readonly payloads = new IpcRequestValidator();
	constructor(private readonly options: DeviceOperationsOptions) {}
	methods(): RemoteMethod[] {
		// Recorded evidence is read here for a phone; the history of an entity is not served yet.
		const kept = ['history'],
			reads = readMethods.filter((method) => !kept.includes(method)),
			agents =
				this.options.grant().agents && this.options.grant().comments !== false ? agentMethods : [];
		const comments = this.options.grant().comments === false ? [] : commentMethods;
		const tracker = Object.entries(trackerCalls(this.options))
			.filter(([, call]) => call !== undefined)
			.map(([method]) => method as RemoteMethod);
		return [attachMethod, ...reads, ...comments, ...agents, ...tracker];
	}
	async handle(request: WireRequest): Promise<unknown> {
		if (!this.methods().includes(request.method)) throw new RemoteFailure('method-denied');
		const { method, input } = request,
			{ agents, projects } = this.options.grant();
		if (method === 'listProjects')
			return projects.map(({ id, name }) => ({ id, name, kind: 'local' }));
		const tracker = trackerCalls(this.options)[method];
		if (tracker) return await this.trackerCall(tracker, input);
		if (method === 'providers') return agents ? this.options.providers.list() : [];
		const project = await this.project(input),
			payload = this.payload(method, input),
			operation = this.operation(project, method);
		if (revisionMethods.includes(method)) await this.revise(project, input);
		this.live();
		return this.shaped(method, await operation(payload));
	}
	private async trackerCall(
		call: (input: Fields) => Promise<unknown>,
		input: Fields
	): Promise<unknown> {
		this.live();
		const value = await call(input);
		this.live();
		return value;
	}
	/** A device revoked while its request was on the way gets nothing done for it. */
	private live(): void {
		if (this.options.projects.ended) throw new RemoteFailure('revoked');
	}
	private async project(input: Fields): Promise<ClientProject> {
		const id = this.inputs.projectId(input),
			granted = this.options.grant().projects.some((project) => project.id === id);
		if (!granted) throw new RemoteFailure('project-denied');
		return this.options.projects.use(id).catch(() => {
			throw new RemoteFailure('project-denied');
		});
	}
	/** The same rules as the desktop's own renderer; what they refuse is an invalid message. */
	private payload(method: RemoteMethod, input: Fields): unknown {
		try {
			const body = { ...input };
			delete body.revision;
			delete body.epoch;
			return this.payloads.parse(channels[method as keyof typeof channels], body);
		} catch {
			throw new RemoteFailure('invalid-message');
		}
	}
	private operation(project: ClientProject, method: RemoteMethod): Operation {
		const operation = (project.bridge as Fields)[method];
		if (typeof operation !== 'function') throw new RemoteFailure('method-denied');
		return operation as Operation;
	}
	/**
	 * A change names the checked-out tip, and the device's own view of the project must be that
	 * branch: a view pinned to a commit stays read-only, even when the commit is the tip.
	 */
	private async revise(project: ClientProject, input: Fields): Promise<void> {
		const { branch, commit } = this.inputs.revision(input),
			{ source } = project.session.requireProject();
		const current = (await source.branches()).find((item) => item.current);
		if (current?.name !== branch || branch === 'harness-evidence')
			throw new RemoteFailure('read-only');
		if (current.tip !== commit) {
			const behind = await ancestor(project.root, commit, current.tip);
			throw new RemoteFailure(behind ? 'read-only' : 'revision-mismatch');
		}
		if (this.options.arbiter.held(project.root)) throw new RemoteFailure('busy');
		await project.session.mutable().catch(() => {
			throw new RemoteFailure('read-only');
		});
	}
	/** Nothing a phone receives names a folder of this computer. */
	private shaped(method: RemoteMethod, value: unknown): unknown {
		const capabilities = deviceCapabilities(
			this.options.grant().agents,
			this.options.grant().comments
		);
		if (method === 'capabilities') return capabilities;
		if (method === 'image') return binaryAnswer(value as Uint8Array);
		if (method === 'artifact')
			return binaryAnswer((value as Artifact).bytes, (value as Artifact).mediaType);
		if (method !== 'snapshot') return value;
		const snapshot = value as ProjectSnapshot,
			project = { ...snapshot.project, root: '' };
		return {
			...snapshot,
			project,
			capabilities,
			writable: snapshot.writable && capabilities.agents
		};
	}
}

export type { DeviceOperationsOptions } from './DeviceOperationsService.types';
