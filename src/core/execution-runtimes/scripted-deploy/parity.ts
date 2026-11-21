import {
	canonical,
	hash,
	type Environment,
	type Observation,
	type Profile,
	type Plan
} from './contracts';
import type { DeployProject } from '../../../validators/execution-runtimes/DeployManifestValidator';

type Fields = Record<string, unknown>;
type Difference = {
	environment: Environment;
	field: string;
	expected: unknown;
	observed: unknown;
	reason: string | null;
};

function fields(profile: Profile): Fields {
	return Object.fromEntries([
		...Object.entries(profile.bindings).map(([key, val]) => ['bindings.' + key, val]),
		...profile.secretNames.map((key) => ['secretNames.' + key, true]),
		['migrations.ordered', profile.migrations],
		...Object.entries(profile.runtimes).map(([key, val]) => ['runtimes.' + key, val]),
		...Object.entries(profile.flags).map(([key, val]) => ['flags.' + key, val])
	]);
}

function diff(
	environment: Environment,
	expected: Fields,
	observed: Fields,
	allowed: Record<string, string>
): Difference[] {
	const keys = [...new Set([...Object.keys(expected), ...Object.keys(observed)])].sort();
	return keys.flatMap((field) => {
		const [before, after] = [expected[field] ?? null, observed[field] ?? null];
		return canonical(before) === canonical(after)
			? []
			: [{ environment, field, expected: before, observed: after, reason: allowed[field] ?? null }];
	});
}

export function assertObservation(target: string, actual: Observation, now = Date.now()): void {
	if (actual.target !== target) throw new Error('Inspection returned the wrong deployment target.');
	if (actual.observedAt > now + 5000 || actual.observedAt < now - 90_000) {
		throw new Error('Deployment inspection is stale.');
	}
}

export function assertTargetProfile(expected: Profile, actual: Observation): void {
	if (diff('staging', fields(expected), fields(actual.profile), {}).length) {
		throw new Error('Live deployment profile drifted after planning.');
	}
}

export function parityReport(
	config: DeployProject,
	observations: Partial<Record<Environment, Observation>>
) {
	const baseline = fields(config.targets.staging.profile);
	const environments = ['staging', 'preprod', 'prod'] as const;
	const differences = environments.flatMap((env) => {
		const target = config.targets[env];
		if (!target) return [];
		const desired = fields(target.profile);
		const actual = observations[env];
		return [
			...diff(env, baseline, desired, config.differences),
			...(actual ? diff(env, desired, fields(actual.profile), {}) : [])
		];
	});
	const coverage = Object.fromEntries(
		environments.map((env) => [env, coverageFor(observations[env], config.targets[env])])
	);
	const snapshots = Object.fromEntries(
		Object.entries(observations).map(([env, value]) => [
			env,
			{
				target: value.target,
				version: value.version,
				source: value.source,
				artifact: value.artifact
			}
		])
	);
	const report = {
		coverage,
		differences,
		snapshots,
		blocked: differences.some(({ reason }) => !reason)
	};
	return { ...report, digest: hash(report) };
}

export function sameVersion(left: Observation, right: Observation): boolean {
	return (
		left.target === right.target &&
		left.version === right.version &&
		left.source === right.source &&
		left.artifact === right.artifact &&
		hash(fields(left.profile)) === hash(fields(right.profile))
	);
}

function coverageFor(observed: Observation | undefined, declared: unknown): string {
	if (observed) return 'observed';
	return declared ? 'declared' : 'absent';
}

export function assertResult(plan: Plan, actual: Observation): void {
	assertObservation(plan.target, actual);
	assertTargetProfile(plan.previous.profile, actual);
	const wanted = plan.restore ?? plan.release;
	if (
		actual.source !== wanted?.source ||
		actual.artifact !== wanted.artifact ||
		wrongVersion(plan, actual)
	) {
		throw new Error('Provider result does not prove the requested deployment or restoration.');
	}
}

function wrongVersion(plan: Plan, actual: Observation): boolean {
	if (plan.restore) return !sameVersion(plan.restore, actual);
	return actual.version === plan.previous.version;
}
