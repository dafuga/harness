import { design } from '../hub-designs/design';
import { hubApproval } from './hubApproval';
import { hubRead } from '../hubSource';
import type { HubSourceContext } from '../hubSource';
import { hubFail } from '../hubJson';
import { hubImageOption, hubOptionInfos, hubRevision } from './hubImageOption';
import type { HubPlan, HubDesign } from '../hubSchemas';
import type { DesignVersion } from '../../../../desktop/src/models/Desktop.types';

async function version(
	context: HubSourceContext,
	plan: HubPlan,
	value: HubDesign,
	latest: string
): Promise<DesignVersion> {
	const base = `${plan.path}/designs/${value.version}/`;
	const prompt = new TextDecoder().decode(
		await hubRead(context, base + value.prompt.file, value.prompt.sha256)
	);
	const notes = value.notes
		? new TextDecoder().decode(await hubRead(context, base + value.notes.file, value.notes.sha256))
		: undefined;
	const approval = await hubApproval(context, plan, value);
	return {
		version: value.version,
		createdAt: value.createdAt,
		commit: null,
		generator: `${value.generator.provider} · ${value.generator.model}`,
		prompt,
		notes,
		baseRevision: value.baseRevision,
		images: value.images.map(({ file, state, viewport, sha256, bytes }) => ({
			...{ state, viewport, sha256, bytes },
			...hubImageOption(value, file)
		})),
		approval: approval
			? {
					id: approval.id,
					version: value.version,
					imageHashes: approval.images.map((i) => i.sha256),
					contractHash: approval.contractHash,
					approvedAt: approval.approvedAt,
					current: value.version === latest,
					...(approval.option ? { option: approval.option } : {})
				}
			: null,
		...(await hubOptionInfos(context, base, value)),
		...hubRevision(value)
	};
}

export async function hubDesigns(context: HubSourceContext, plan: HubPlan) {
	const designs = await Promise.all(
		context.entries
			.filter(
				(e) => e.path.startsWith(`${plan.path}/designs/`) && /\/v\d+\/design.json$/.test(e.path)
			)
			.map((e) => design(context, plan, e.path))
	);
	designs.sort((a, b) => Number(a.version.slice(1)) - Number(b.version.slice(1)));
	designs.forEach((d, i) => {
		if (Number(d.version.slice(1)) !== i + 1) hubFail();
	});
	return Promise.all(designs.map((d) => version(context, plan, d, designs.at(-1)?.version ?? '')));
}
