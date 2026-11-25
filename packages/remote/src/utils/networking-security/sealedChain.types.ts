// @harness-uid u_7tgdli7pdw
import type {
	SealedChainBody,
	SealedChainPin
} from '../../models/networking-security/Sealed.types';

/** One chain body variant by its type. */
export type Body<T extends SealedChainBody['type']> = Extract<SealedChainBody, { type: T }>;

/** The account a chain must belong to and, after a first verification, the pin it must extend. */
export interface ChainExpectation {
	account: string;
	pin?: SealedChainPin;
}
