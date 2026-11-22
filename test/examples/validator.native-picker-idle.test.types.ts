import type { NativePickerIdleValidator } from '../../src/validators/development-tooling/NativePickerIdleValidator';

export type Validate = NativePickerIdleValidator['validate'];

export type PickerData = Parameters<Validate>[0];

export type PickerRpc = Parameters<Validate>[1];

export type RpcCall = { method: string; params: PickerData };
