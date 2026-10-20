import { BuildIdentityService } from '../../../src/services/BuildIdentityService';
import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
/** Records only standardized catalog checkpoints against the exact compiled fixture files. */
export async function recordCatalogCapture(
	home: string,
	name: string,
	bytes: Uint8Array
): Promise<void> {
	const catalog = /^component-cards-(tip|bbbbbbb|aaaaaaa|reused)-(desktop|tablet|mobile)$/.exec(
		name
	);
	if (!catalog) return;
	const states: Record<string, string> = {
		tip: 'current',
		bbbbbbb: 'previous',
		aaaaaaa: 'initial',
		reused: 'inherited'
	};
	const built = await new BuildIdentityService().identify(home);
	if (!built) throw new Error('Component catalog preview build is missing.');
	recordCapture(
		{
			evidence: catalog[1] === 'reused' ? 'inherited-screens' : 'screens',
			kind: 'screenshot',
			state: states[catalog[1]],
			viewport: catalog[2],
			file: `${name}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: {
				buildId: built.buildId,
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
}
