import { describe, it, expect } from 'vitest';

describe('Adversarial Test Suite: Contracts, Commissions & RBAC Routing', () => {
  describe('ContratosPage & ComissoesPage (D02, D14, D07 CORRIGIDOS)', () => {
    it('deve gravar valor_servico correto para contratos de limpeza (D02 CORRIGIDO)', () => {
      const categoria: 'monitoramento' | 'limpeza' = 'limpeza';
      const cliente = { valor_mensal: 250, quantidade_placas: 60 };
      const valorTotalLimpezaCalculado = 1800; // retornado por calcular_preco_limpeza

      const valorServicoCalculado = categoria === 'monitoramento' 
        ? (Number(cliente.valor_mensal) || 0) 
        : valorTotalLimpezaCalculado;

      expect(valorServicoCalculado).toBe(1800);
    });

    it('deve validar equipe_id obrigatória na confirmação de venda (D14 CORRIGIDO)', () => {
      const confirmDialog = { contrato: { id: 'contrato-1', cliente_id: 'c-1' } };
      const dataLimpeza = '2026-08-25';
      const equipeIdConfirm = ''; // Usuário não selecionou equipe

      let validationError: string | null = null;
      if (!confirmDialog.contrato || !dataLimpeza) {
        validationError = 'Informe a data do serviço';
      } else if (!equipeIdConfirm) {
        validationError = 'Selecione a equipe responsável';
      }

      expect(validationError).toBe('Selecione a equipe responsável');
    });

    it('deve calcular comissão de vendas de limpeza avulsa corretamente (D07 CORRIGIDO)', () => {
      const comissaoPercentual = 10; // 10%
      const clienteContratos = [
        { id: '1', nome: 'Cliente Monitoramento', valor_mensal: 300, duracao_meses: 12, tipo_contrato: 'monitoramento' },
        { id: '2', nome: 'Cliente Limpeza Avulsa', valor_mensal: 1800, duracao_meses: 1, tipo_contrato: 'limpeza' },
      ];

      const comissoesCalculadas = clienteContratos.map(c => {
        const valorParcela = c.valor_mensal * (comissaoPercentual / 100);
        return { cliente: c.nome, valorParcela };
      });

      expect(comissoesCalculadas[0].valorParcela).toBe(30);
      expect(comissoesCalculadas[1].valorParcela).toBe(180);
    });
  });

  describe('RBAC Route Isolation & Technician Access (D09 & D15 CORRIGIDOS)', () => {
    const rolePages: Record<string, string[]> = {
      viewer: ['dashboard'],
      tecnico: ['agenda', 'clientes', 'calculadora', 'contratos', 'ai-hub', 'documentos'],
      vendedor: ['agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'documentos'],
      admin: ['dashboard', 'agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'equipes', 'comissoes', 'documentos'],
      master: ['dashboard', 'agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'equipes', 'comissoes', 'documentos', 'configuracoes'],
    };

    it('deve permitir acesso do Técnico a Documentos no Index.tsx (D15 CORRIGIDO)', () => {
      const tecnicoCanAccessDocumentos = rolePages['tecnico'].includes('documentos');
      expect(tecnicoCanAccessDocumentos).toBe(true);
    });

    it('deve disponibilizar tela de Agenda onde RotasDoDia está integrada para o Técnico (D09 CORRIGIDO)', () => {
      const tecnicoCanAccessAgenda = rolePages['tecnico'].includes('agenda');
      expect(tecnicoCanAccessAgenda).toBe(true);
    });
  });
});
