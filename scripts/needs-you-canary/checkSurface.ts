// @harness-uid u_cmhc246euj
import { answerOnWeb, awaitTap } from './awaitAnswer';
import { addArgs, canaryAsk, flagArgs } from './canaryAsk';
import type {
	CanaryAsk,
	CanaryOptions,
	CanaryResult,
	CanarySurface,
	CanaryWeb
} from './canary.types';

export const signedOut =
	'the automation Chrome has no signed-in Hub session (Google refuses scripted sign-in, mn6ffm)';

/** Raise one test ask, have it answered, read it back, and always close the test item. */
async function raiseAndAnswer(
	options: CanaryOptions,
	ask: CanaryAsk,
	web: CanaryWeb | null
): Promise<CanaryResult> {
	const { surface } = ask;
	let itemId: string | undefined;
	let result: CanaryResult;
	try {
		itemId = (await options.tracker(addArgs(ask))).id;
		await options.tracker(flagArgs(itemId, ask));
		const outcome = web
			? await answerOnWeb(options, web, itemId, ask)
			: await awaitTap(options, itemId, ask);
		result = { surface, itemId, ...outcome };
	} catch (error) {
		options.log(`${surface}: ${error instanceof Error ? error.message : String(error)}`);
		result = { surface, itemId, state: 'failed', detail: 'the check stopped on an error' };
	}
	return itemId ? closeTestItem(options, itemId, result) : result;
}

async function closeTestItem(
	options: CanaryOptions,
	id: string,
	result: CanaryResult
): Promise<CanaryResult> {
	try {
		const item = await options.tracker(['show', id]);
		if (item.needs_daniel && !item.answered_at) await options.tracker(['unflag', id]);
		const note = `release canary finished: ${result.surface} ${result.state}`;
		await options.tracker(['done', id, '--note', note]);
		return result;
	} catch (error) {
		options.log(`cleanup ${id}: ${error instanceof Error ? error.message : String(error)}`);
		const detail = `${result.detail}; cleanup failed, test item ${id} may still be open`;
		return { ...result, state: 'failed', detail };
	}
}

/** The tab for a scripted web answer, or why Hub web cannot be seen. */
async function signedInTab(options: CanaryOptions): Promise<CanaryWeb | string> {
	let web: CanaryWeb | undefined;
	try {
		web = await options.web();
		if (await web.signedIn()) return web;
		await web.close();
		return signedOut;
	} catch (error) {
		options.log(`web: ${error instanceof Error ? error.message : String(error)}`);
		await web?.close().catch(() => {});
		return 'the automation Chrome or the production Hub could not be reached';
	}
}

export async function checkSurface(
	options: CanaryOptions,
	surface: CanarySurface
): Promise<CanaryResult> {
	const byHand = options.taps.has(surface);
	if (!byHand && surface !== 'web')
		return { surface, state: 'not-seen', detail: 'only a tap can check it; run with --tap' };
	const web = byHand ? null : await signedInTab(options);
	if (typeof web === 'string') return { surface, state: 'not-seen', detail: web };
	const ask = canaryAsk({
		surface,
		release: options.release,
		nonce: options.nonce(),
		expected: options.pick(3) + 1,
		byHand
	});
	try {
		return await raiseAndAnswer(options, ask, web);
	} finally {
		await web?.close().catch(() => options.log('web: the canary tab did not close'));
	}
}
