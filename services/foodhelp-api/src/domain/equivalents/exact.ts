import type { EquivalentResult } from '@foodhelp/contracts';

type Fraction = { numerator: bigint; denominator: bigint };

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function parseAmount(value: string): Fraction {
  const [numeratorText, denominatorText] = value.split('/');
  if (denominatorText === undefined) return parseDecimal(value);
  const numerator = BigInt(numeratorText);
  const denominator = BigInt(denominatorText);
  if (numerator <= 0n || denominator <= 0n) throw new RangeError('La porcion debe ser mayor que cero.');
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function parseDecimal(value: string): Fraction {
  const [whole, fractional = ''] = value.split('.');
  const denominator = 10n ** BigInt(fractional.length);
  const numerator = BigInt(`${whole}${fractional}`);
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function add(left: Fraction, right: Fraction): Fraction {
  const numerator = left.numerator * right.denominator + right.numerator * left.denominator;
  const denominator = left.denominator * right.denominator;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function multiply(left: Fraction, right: Fraction): Fraction {
  const numerator = left.numerator * right.numerator;
  const denominator = left.denominator * right.denominator;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function equivalentFraction(quantity: string, baseQuantity: string): { numerator: string; denominator: string } {
  const amount = parseAmount(quantity);
  const base = parseAmount(baseQuantity);
  if (base.numerator <= 0n) throw new RangeError('La porcion base debe ser mayor que cero.');
  const result = multiply(amount, { numerator: base.denominator, denominator: base.numerator });
  return { numerator: result.numerator.toString(), denominator: result.denominator.toString() };
}

export function sumAmounts(values: string[]): string {
  const result = values.reduce((sum, value) => add(sum, parseAmount(value)), { numerator: 0n, denominator: 1n });
  return result.denominator === 1n ? result.numerator.toString() : `${result.numerator}/${result.denominator}`;
}

export function rationallyEqual(left: string, right: string): boolean {
  const a = parseAmount(left);
  const b = parseAmount(right);
  return a.numerator * b.denominator === b.numerator * a.denominator;
}
function asFiniteDecimal(value: Fraction): string | null {
  let rest = value.denominator;
  let twos = 0;
  let fives = 0;
  while (rest % 2n === 0n) { rest /= 2n; twos += 1; }
  while (rest % 5n === 0n) { rest /= 5n; fives += 1; }
  if (rest !== 1n) return null;
  const places = Math.max(twos, fives);
  const scaled = value.numerator * (10n ** BigInt(places)) / value.denominator;
  if (places === 0) return scaled.toString();
  const digits = scaled.toString().padStart(places + 1, '0');
  const fraction = digits.slice(-places).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -places)}.${fraction}` : digits.slice(0, -places);
}

export function calculateEquivalent(quantity: string, baseQuantity: string): EquivalentResult {
  const ratio = equivalentFraction(quantity, baseQuantity);
  const reduced = { numerator: BigInt(ratio.numerator), denominator: BigInt(ratio.denominator) };
  return { numerator: reduced.numerator.toString(), denominator: reduced.denominator.toString(), decimal: asFiniteDecimal(reduced) };
}

export function multiplyAmount(value: string, factor: number): string {
  if (!Number.isSafeInteger(factor) || factor < 0) throw new RangeError('El multiplicador debe ser un entero no negativo.');
  const result = multiply(parseAmount(value), { numerator: BigInt(factor), denominator: 1n });
  return result.denominator === 1n ? result.numerator.toString() : `${result.numerator}/${result.denominator}`;
}