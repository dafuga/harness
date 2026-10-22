import { design } from '../../../../utils/networking-security/hub-designs/design';
import { hubPng } from './hubPng';
import { hubRead } from '../../../../utils/development-tooling/hubSource';
import type { HubSourceContext } from '../../../../utils/development-tooling/hubSource';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import type { HubPlan } from '../../../../utils/development-tooling/hubSchemas';

export async function hubDesignImage(
	context: HubSourceContext,
	plan: HubPlan,
	input: { version: string; sha256: string }
) {
	const value = await design(context, plan, `${plan.path}/designs/${input.version}/design.json`);
	const image = value.images.find((i) => i.sha256 === input.sha256);
	if (!image) return hubFail('not-found');
	const bytes = await hubRead(
		context,
		`${plan.path}/designs/${value.version}/${image.file}`,
		image.sha256
	);
	if (bytes.length !== image.bytes) return hubFail();
	const decoded = await hubPng(bytes);
	if (decoded.width !== image.width || decoded.height !== image.height) return hubFail();
	return bytes;
}
