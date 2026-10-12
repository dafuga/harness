import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { RemoteHttpOptions } from '../adapters/HostedHttpAdapter';
import type { CacheStatus } from '../models/ProjectContext.types';
import { HostedFailureValidator } from '../validators/HostedFailureValidator';
import type { ProjectionCacheService } from './ProjectionCacheService';
export interface HostedReadOptions extends RemoteHttpOptions {
	cache?: ProjectionCacheService;
	onCacheStatus?: (status: CacheStatus) => void;
}
export class HostedReadService {
	constructor(private options: HostedReadOptions) {}
	async read<T>(
		query: { projectId: string; key: string },
		load: () => Promise<{ value: T; identity?: CacheIdentity }>,
		validate: (value: unknown) => T
	) {
		const generation = this.generation();
		const credential = await this.credential();
		const guard = this.guard(credential, generation);
		await guard();
		const context = {
			guard,
			principalId: credential.principalId,
			projectId: query.projectId,
			scope: JSON.stringify([credential.origin, credential.principalId, query.projectId, query.key])
		};
		try {
			return await this.fresh(context, await load());
		} catch (error) {
			return this.offline(context, error, validate);
		}
	}
	private generation() {
		return `${this.options.authorityVersion?.() ?? 0}:${this.options.cache?.generation ?? 0}`;
	}
	private guard(
		credential: { origin: string; principalId: string; token: string },
		generation: string
	) {
		return async () => {
			const current = await this.options.credentials();
			if (
				generation === this.generation() &&
				JSON.stringify(current) === JSON.stringify(credential)
			)
				return;
			this.options.onCacheStatus?.({ projectId: '$projects', status: 'denied' });
			await this.options.cache?.purge(credential.principalId);
			throw new Error('Hosted authority changed during the read.');
		};
	}
	private async credential() {
		const credential = await this.options.credentials();
		if (
			!credential ||
			credential.origin !== new URL(this.options.origin).origin ||
			!credential.token ||
			!credential.principalId
		) {
			this.options.onCacheStatus?.({ projectId: '$projects', status: 'denied' });
			throw new Error('A verified hosted session is required.');
		}
		return credential;
	}
	private async fresh<T>(
		context: { scope: string; principalId: string; projectId: string; guard: () => Promise<void> },
		result: { value: T; identity?: CacheIdentity }
	) {
		await context.guard();
		if (result.identity) validateIdentity(result.identity, context);
		const cachedAt = result.identity
			? await this.options.cache?.remember(context.scope, result.identity, result.value)
			: undefined;
		await context.guard();
		this.options.onCacheStatus?.({ projectId: context.projectId, status: 'fresh', cachedAt });
		return { value: result.value, cachedAt, offline: false };
	}
	private async offline<T>(
		context: { scope: string; principalId: string; projectId: string; guard: () => Promise<void> },
		error: unknown,
		validate: (value: unknown) => T
	) {
		if (error instanceof HostedFailureValidator && error.category === 'denied')
			await this.options.cache?.purge(
				context.principalId,
				error.status === 401 ? undefined : context.projectId
			);
		if (!(error instanceof HostedFailureValidator) || error.category !== 'offline') throw error;
		await context.guard();
		const entry = await this.options.cache?.lookup(context.scope);
		if (!entry) throw error;
		validateIdentity(entry.identity, context);
		const value = validate(entry.value);
		await context.guard();
		this.options.onCacheStatus?.({
			projectId: context.projectId,
			status: 'offline',
			cachedAt: entry.cachedAt
		});
		return { value, cachedAt: entry.cachedAt, offline: true };
	}
}
function validateIdentity(
	identity: CacheIdentity,
	context: { principalId: string; projectId: string }
) {
	if (identity.principalId !== context.principalId || identity.projectId !== context.projectId)
		throw new Error('Hosted cache identity mismatch.');
	const collaboration = identity.collaborationRevision;
	if (
		collaboration != null &&
		(typeof collaboration !== 'string' || !/^[a-f0-9]{40}$/.test(collaboration))
	)
		throw new Error('Invalid hosted collaboration revision.');
	const fields = [
		'repositoryId',
		'requestedRef',
		'sourceCommit',
		'sourceTree',
		'notesRef',
		'notesRevision',
		'evidenceRef',
		'evidenceRevision',
		'historyIndexRevision',
		'artifactHash',
		'profile'
	];
	if (fields.some((key) => !Object.hasOwn(identity, key)))
		throw new Error('Incomplete hosted cache identity.');
	if (![identity.sourceCommit, identity.sourceTree].every((value) => /^[a-f0-9]{40}$/.test(value)))
		throw new Error('Invalid hosted cache revision.');
}
