import { describe, it, expect } from 'vitest';

interface FaixaPreco {
  id: string;
  faixa_inicio: number;
  faixa_fim: number | null;
  valor: number;
  label: string | null;
  ordem: number;
}

const faixasPadrao: FaixaPreco[] = [
  { id: '1', faixa_inicio: 1, faixa_fim: 30, valor: 35.0, label: '1 a 30', ordem: 1 },
  { id: '2', faixa_inicio: 31, faixa_fim: 70, valor: 30.0, label: '31 a 70', ordem: 2 },
  { id: '3', faixa_inicio: 71, faixa_fim: 150, valor: 25.0, label: '71 a 150', ordem: 3 },
  { id: '4', faixa_inicio: 151, faixa_fim: 300, valor: 20.0, label: '151 a 300', ordem: 4 },
  { id: '5', faixa_inicio: 301, faixa_fim: null, valor: 15.0, label: '301+', ordem: 5 },
];

function calcularFaixasFromDB(modulos: number, faixas: FaixaPreco[]) {
  const result: { faixa: string; qtd: number; preco: number; subtotal: number }[] = [];
  let restante = modulos;
  for (const f of faixas) {
    if (restante <= 0) break;
    const faixaMax = f.faixa_fim === null ? restante : f.faixa_fim - f.faixa_inicio + 1;
    const qtd = Math.min(restante, faixaMax);
    result.push({ faixa: f.label || `${f.faixa_inicio}+`, qtd, preco: f.valor, subtotal: qtd * f.valor });
    restante -= qtd;
  }
  return result;
}

function calcularPrecoLimpezaMock(modulos: number, faixas: FaixaPreco[] = faixasPadrao): number {
  if (modulos <= 0) return 0;
  const breakdown = calcularFaixasFromDB(modulos, faixas);
  return breakdown.reduce((acc, curr) => acc + curr.subtotal, 0);
}

function aplicarDesconto(
  resultado: number,
  descontoTipo: 'percentual' | 'fixo',
  descontoValor: number
): { descontoCalculado: number; resultadoComDesconto: number } {
  const descontoCalculado = descontoTipo === 'percentual'
    ? resultado * (descontoValor / 100)
    : descontoValor;
  const resultadoComDesconto = Math.max(0, resultado - descontoCalculado);
  return { descontoCalculado, resultadoComDesconto };
}

describe('Adversarial Test Suite: Calculadora & Solar Sizing Engine', () => {
  describe('Extreme Input Testing (0 plates, negative, 5000 plates)', () => {
    it('deve rejeitar ou retornar 0 para 0 placas e valores negativos', () => {
      expect(calcularPrecoLimpezaMock(0)).toBe(0);
      expect(calcularPrecoLimpezaMock(-10)).toBe(0);
    });

    it('deve calcular corretamente para usinas de grande porte (5.000 placas)', () => {
      const modulos = 5000;
      const total = calcularPrecoLimpezaMock(modulos);
      const breakdown = calcularFaixasFromDB(modulos, faixasPadrao);

      // 1-30: 30 * 35 = 1050
      // 31-70: 40 * 30 = 1200
      // 71-150: 80 * 25 = 2000
      // 151-300: 150 * 20 = 3000
      // 301-5000: 4700 * 15 = 70500
      // Total: 1050 + 1200 + 2000 + 3000 + 70500 = 77750
      expect(total).toBe(77750);
      expect(breakdown.length).toBe(5);
      expect(breakdown[4].qtd).toBe(4700);
      expect(breakdown[4].subtotal).toBe(70500);

      // Preço médio por módulo
      const precoMedio = total / modulos;
      expect(precoMedio).toBeCloseTo(15.55, 2);
    });
  });

  describe('Adversarial Discount Testing (Negative discounts, >100% discount)', () => {
    it('PROVA EMPÍRICA DE FALHA: Desconto negativo aumenta o preço sem validação prévia', () => {
      const resultado = 1000;
      // Usuário digita ou cola "-20%" no input
      const { descontoCalculado, resultadoComDesconto } = aplicarDesconto(resultado, 'percentual', -20);
      
      console.log('Desconto com -20%:', { descontoCalculado, resultadoComDesconto });
      
      // O desconto vira -R$ 200, e o preço final sobre para R$ 1.200!
      expect(descontoCalculado).toBe(-200);
      expect(resultadoComDesconto).toBe(1200);
    });

    it('Desconto de 100% resulta em R$ 0,00', () => {
      const resultado = 1000;
      const { resultadoComDesconto } = aplicarDesconto(resultado, 'percentual', 100);
      expect(resultadoComDesconto).toBe(0);
    });

    it('Desconto fixo maior que o valor total é limitado a 0 (Math.max)', () => {
      const resultado = 1000;
      const { resultadoComDesconto } = aplicarDesconto(resultado, 'fixo', 1500);
      expect(resultadoComDesconto).toBe(0);
    });
  });
});
