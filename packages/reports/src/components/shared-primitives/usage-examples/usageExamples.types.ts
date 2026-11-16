// @harness-uid u_3gfk6b2moy
/** Every JavaScript value; BigInts, cycles and throwing getters make compact throw. */
export type CompactValue = string | number | boolean | bigint | symbol | null | undefined | object;
export type Fields = Record<string, CompactValue>;
