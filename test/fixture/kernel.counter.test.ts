import { expect, test } from 'vitest';
import { captureExample } from '../support/captureExample';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const directory = '.cache/harness/native-counter'; mkdirSync(directory, { recursive: true });
const source = '#[path = ' + JSON.stringify(resolve('crates/counter/src/lib.rs')) + '] mod implementation;\nfn main() { let value: i32 = std::env::args().nth(1).unwrap().parse().unwrap(); println!("{}", implementation::sign(value)); }';
writeFileSync(directory + '/main.rs', source);
execFileSync('rustc', [directory + '/main.rs', '-o', directory + '/sign']);
const sign = (value: number) => Number(execFileSync(directory + '/sign', [String(value)], { encoding: 'utf8' }).trim());

test('sign: value -1', async () => { const actual = await sign(-1); expect(actual).toEqual(-1); captureExample({ unit: 'kernel.counter', id: 'sign-negative', state: 'initialized' }, actual, -1); });
test('sign: value 0', async () => { const actual = await sign(0); expect(actual).toEqual(1); captureExample({ unit: 'kernel.counter', id: 'sign-zero', state: 'initialized' }, actual, 1); });
test('sign: value 1', async () => { const actual = await sign(1); expect(actual).toEqual(1); captureExample({ unit: 'kernel.counter', id: 'sign-positive', state: 'initialized' }, actual, 1); });
