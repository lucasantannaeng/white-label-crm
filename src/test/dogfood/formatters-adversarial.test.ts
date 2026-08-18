import { describe, it, expect } from 'vitest';
import { numeroExtenso, valorExtenso, maskPhone, formatWhatsAppUrl } from '@/lib/formatters';

describe('Adversarial Test Suite: Formatters & Math Core', () => {
  describe('numeroExtenso & valorExtenso Edge Cases', () => {
    it('deve formatar valores pequenos e zero corretamente', () => {
      expect(numeroExtenso(0)).toBe('zero');
      expect(valorExtenso(0)).toBe('Zero reais');
      expect(numeroExtenso(1)).toBe('um');
      expect(valorExtenso(1)).toBe('Um real');
      expect(valorExtenso(1.5)).toBe('Um real e cinquenta centavos');
      expect(valorExtenso(0.25)).toBe('Vinte e cinco centavos');
    });

    it('deve formatar centenas e milhares normais', () => {
      expect(numeroExtenso(100)).toBe('cem');
      expect(numeroExtenso(101)).toBe('cento e um');
      expect(numeroExtenso(1000)).toBe('mil');
      expect(numeroExtenso(1500)).toBe('mil e quinhentos');
      expect(numeroExtenso(999999)).toBe('novecentos e noventa e nove mil e novecentos e noventa e nove');
    });

    it('deve formatar valores >= R$ 1.000.000 corretamente (D01 CORRIGIDO)', () => {
      // Teste com R$ 1.000.000
      const extenso1M = numeroExtenso(1000000);
      expect(extenso1M).toBe('um milhão');

      // Teste com R$ 1.500.000 (Usina Solar Comercial)
      const extenso1_5M = numeroExtenso(1500000);
      expect(extenso1_5M).toBe('um milhão e quinhentos mil');

      const valor1_5M = valorExtenso(1500000);
      expect(valor1_5M).toBe('Um milhão e quinhentos mil reais');

      // Teste com R$ 2.350.000,50
      expect(valorExtenso(2350000.50)).toBe('Dois milhões e trezentos e cinquenta mil reais e cinquenta centavos');
    });
  });

  describe('WhatsApp Link & Brazilian DDD 55 Edge Case (D17)', () => {
    it('deve gerar link com DDD 22 (Região dos Lagos)', () => {
      const link = formatWhatsAppUrl('(22) 99999-8888', 'Olá João');
      expect(link).toBe('https://wa.me/5522999998888?text=Ol%C3%A1%20Jo%C3%A3o');
    });

    it('deve gerar link com DDD 55 (Santa Maria / RS) incluindo DDI 55 (D17 CORRIGIDO)', () => {
      // Número de Santa Maria / RS: DDD 55, celular 98888-7777 (11 dígitos no total)
      const telefoneRS = '(55) 98888-7777';
      const link = formatWhatsAppUrl(telefoneRS, 'Olá Carlos');
      // O correto para o WhatsApp é 5555988887777 (13 dígitos com DDI 55)
      expect(link).toBe('https://wa.me/5555988887777?text=Ol%C3%A1%20Carlos');
    });
  });
});
