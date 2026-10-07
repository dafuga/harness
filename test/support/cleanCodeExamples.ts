export interface CleanCodeExample {
	name: string;
	path: string;
	code: string;
	expected: 'meets' | 'violates';
}

// Human-labelled naming examples. This small corpus is an initial calibration probe,
// not a representative benchmark of every rubric principle or real-world project.
export const cleanCodeExamples: CleanCodeExample[] = [
	example(
		'TypeScript clear names',
		'price.ts',
		'export function calculateTotal(unitPrice: number, quantity: number) { return unitPrice * quantity; }',
		'meets'
	),
	example(
		'TypeScript obscure names',
		'price.ts',
		'export function a(b: number, c: number) { const d = b * c; return d; }',
		'violates'
	),
	example(
		'JavaScript clear names',
		'price.js',
		'export function calculateTotal(unitPrice, quantity) { return unitPrice * quantity; }',
		'meets'
	),
	example(
		'JavaScript obscure names',
		'price.js',
		'export function a(b, c) { const d = b * c; return d; }',
		'violates'
	),
	example(
		'Svelte clear names',
		'Price.svelte',
		'<script>export let unitPrice = 0; export let quantity = 1; $: totalPrice = unitPrice * quantity;</script>\n<p>Total price: {totalPrice}</p>',
		'meets'
	),
	example(
		'Svelte obscure names',
		'Price.svelte',
		'<script>export let a = 0; export let b = 1; $: c = a * b;</script>\n<p>Total price: {c}</p>',
		'violates'
	),
	example(
		'Python clear names',
		'price.py',
		'def calculate_total(unit_price, quantity):\n    return unit_price * quantity\n',
		'meets'
	),
	example(
		'Python obscure names',
		'price.py',
		'def a(b, c):\n    d = b * c\n    return d\n',
		'violates'
	),
	example(
		'C++ clear names',
		'price.cpp',
		'double calculate_total(double unit_price, int quantity) { return unit_price * quantity; }',
		'meets'
	),
	example(
		'C++ obscure names',
		'price.cpp',
		'double a(double b, int c) { double d = b * c; return d; }',
		'violates'
	),
	example(
		'SQL clear names',
		'price.sql',
		'CREATE TABLE order_items (unit_price DECIMAL, quantity INTEGER);\nSELECT SUM(unit_price * quantity) AS total_price FROM order_items;',
		'meets'
	),
	example(
		'SQL obscure names',
		'price.sql',
		'CREATE TABLE a (b DECIMAL, c INTEGER);\nSELECT SUM(b * c) AS d FROM a;',
		'violates'
	),
	example(
		'Shell clear names',
		'price.sh',
		'calculate_total() {\n  local unit_price="$1" quantity="$2"\n  printf "%s\\n" "$((unit_price * quantity))"\n}\n',
		'meets'
	),
	example(
		'Shell obscure names',
		'price.sh',
		'a() {\n  local b="$1" c="$2"\n  d=$((b * c))\n  printf "%s\\n" "$d"\n}\n',
		'violates'
	)
];

function example(
	name: string,
	path: string,
	code: string,
	expected: CleanCodeExample['expected']
): CleanCodeExample {
	return { name, path, code, expected };
}
