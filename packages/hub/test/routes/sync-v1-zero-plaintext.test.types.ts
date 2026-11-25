import type { sealedScopeKeys } from '../../../remote/src/utils/networking-security/sealedScopeKeys';

export type Keys = Awaited<ReturnType<typeof sealedScopeKeys>>;
