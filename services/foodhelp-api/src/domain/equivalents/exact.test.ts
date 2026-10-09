import { describe, expect, it } from 'vitest';
import { calculateEquivalent, equivalentFraction, multiplyAmount, rationallyEqual, sumAmounts } from './exact';

describe('equivalencias exactas', () => {
  it('cubre los ejemplos aritmeticos acordados sin tratarlos como prescripciones', () => {
    expect(calculateEquivalent('2', '4')).toEqual({ numerator: '1', denominator: '2', decimal: '0.5' });
    expect(calculateEquivalent('3', '2')).toEqual({ numerator: '3', denominator: '2', decimal: '1.5' });
  });
  it('no aproxima resultados decimales periodicos', () => {
    expect(calculateEquivalent('1', '3')).toEqual({ numerator: '1', denominator: '3', decimal: null });
  });
  it('mantiene exactas las entradas decimales', () => {
    expect(calculateEquivalent('0.3', '0.2')).toEqual({ numerator: '3', denominator: '2', decimal: '1.5' });
  });
  it('mantiene exactas las porciones fraccionarias del catalogo', () => {
    expect(calculateEquivalent('1', '1/7')).toEqual({ numerator: '7', denominator: '1', decimal: '7' });
    expect(calculateEquivalent('1', '3/4')).toEqual({ numerator: '4', denominator: '3', decimal: null });
  });
  it('sums ingredient quantities exactly across meal repetitions and people', () => {
    expect(sumAmounts(['2', '2', '2', '3', '3'])).toBe('12');
    expect(sumAmounts(['1/2', '1/3'])).toBe('5/6');
    expect(multiplyAmount('1/3', 6)).toBe('2');
    expect(equivalentFraction('6', '2')).toEqual({ numerator: '3', denominator: '1' });
    expect(rationallyEqual('1.5', '3/2')).toBe(true);
    expect(rationallyEqual('5/6', '1')).toBe(false);
  });
});