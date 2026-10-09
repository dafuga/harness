export interface NativePickerIdleValidatorResult {
	valid: boolean;
	errors: string[];
}

export class NativePickerIdleValidator {
	async validate(input: PickerData, rpc: PickerRpc): Promise<NativePickerIdleValidatorResult> {
		const status = nativePickerProtocol(input.status).type;
		if (status === 'idle') return { valid: true, errors: [] };
		if (status === 'systemError') {
			const history = nativePickerProtocol(
				(await rpc('thread/read', { threadId: input.id, includeTurns: true })).thread
			);
			const turns = history.turns;
			if (
				Array.isArray(turns) &&
				nativePickerProtocol(turns.at(-1)).status === 'failed' &&
				!turns.some((turn) => nativePickerProtocol(turn).status === 'inProgress')
			)
				return { valid: true, errors: [] };
		}
		return {
			valid: false,
			errors: ['Provider switching requires an idle chat or a confirmed completed failure']
		};
	}
}
import {
	nativePickerProtocol,
	type PickerData,
	type PickerRpc
} from '../utils/nativePickerProtocol';
