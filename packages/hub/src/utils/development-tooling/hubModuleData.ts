import { ModuleDataSnapshotValidator } from '../../../../../src/validators/development-tooling/ModuleDataSnapshotValidator';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../../../src/utils/development-tooling/canonicalJson';
import { formatModuleDataFailure } from '../../../../../src/helpers/git-source-history/formatModuleDataFailure';
import type { ModuleData } from '../../../../../src/services/git-source-history/ModuleDataService.types';
import type { HubSourceContext } from './hubSource';
import { hubFail } from './hubJson';
import {
	moduleDataProducer as producer,
	moduleDataRef
} from '../../../../../src/services/git-source-history/module-data-service/moduleDataProtocol';
export async function hubModuleData(context: HubSourceContext, admit = false): Promise<ModuleData> {
	const tip = await context.source.optionalRef(context.repository, moduleDataRef);
	if (!tip)
		throw new Error('Missing committed module data; run harness validate --write --sync origin.');
	const identity = {
		producer,
		commit: context.commit,
		tree: context.identity.sourceTree,
		inputs: { notes: context.identity.notesRevision, evidence: context.identity.evidenceRevision }
	};
	const data = await readModuleSnapshot(context, tip.commit, identity);
	if (!validModuleSnapshot(data, identity)) return hubFail();
	const failure = admit ? formatModuleDataFailure(data) : undefined;
	if (failure) throw new Error(failure);
	return data;
}
export function hubRequiresModuleData(context: HubSourceContext) {
	return context.entries.some((entry) => entry.path === 'harness.validation.json');
}

async function readModuleSnapshot(
	context: HubSourceContext,
	tip: string,
	identity: { producer: string; commit: string; tree: string; inputs: unknown }
) {
	const hash = createHash('sha256').update(canonicalJson(identity)).digest('hex');
	const exact = `modules/${context.commit}/${hash}.json`;
	const paths = (await context.source.tree(context.repository, tip)).map((entry) => entry.path);
	const reviews = await Promise.all(
		paths
			.filter((path) => path.startsWith(`reviews/${context.commit}/`))
			.map(
				async (path) =>
					JSON.parse(
						new TextDecoder().decode(
							await context.source.read(context.repository, { commit: tip, path })
						)
					).digest as string
			)
	);
	const expected = reviews.sort().join();
	const candidates = paths.includes(exact)
		? [exact]
		: paths.filter((path) => path.startsWith(`modules/${context.commit}/`));
	for (const path of candidates) {
		const bytes = await context.source.read(context.repository, { commit: tip, path });
		const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as ModuleData;
		if (
			data.producer === producer &&
			data.commit === identity.commit &&
			data.tree === identity.tree &&
			(data.reviews ?? [])
				.map((item) => item.digest)
				.sort()
				.join() === expected
		)
			return data;
	}
	throw new Error('Missing committed module data; run harness validate --write --sync origin.');
}

function validModuleSnapshot(data: ModuleData, identity: Pick<ModuleData, 'commit' | 'tree'>) {
	const { digest, ...body } = data;
	return (
		data.schemaVersion === 1 &&
		new ModuleDataSnapshotValidator().validate(data).valid &&
		data.producer === producer &&
		createHash('sha256').update(canonicalJson(body)).digest('hex') === digest &&
		data.commit === identity.commit &&
		data.tree === identity.tree
	);
}
