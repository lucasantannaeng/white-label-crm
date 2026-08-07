/**
 * Shared utility for DOCX contract generation to avoid duplication
 * between CalculadoraPage and ContratosPage.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { formatCurrency, valorExtenso, duracaoExtenso, dataExtenso } from '@/lib/formatters';

export interface ContractClienteData {
  nome: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  documento: string;
}

export interface LimpezaContractData {
  cliente: ContractClienteData;
  qtdModulos: number;
  valorTotal: number;
  valorMedio: number;
  templateUrl: string;
}

export interface MonitoramentoContractData {
  cliente: ContractClienteData;
  valorMensal: number;
  duracaoMeses: number;
  templateUrl: string;
}

async function fetchTemplate(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Falha ao baixar template');
  return response.arrayBuffer();
}

function createDoc(arrayBuffer: ArrayBuffer, data: Record<string, string>): Blob {
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function gerarContratoLimpezaDocx(data: LimpezaContractData): Promise<void> {
  const now = new Date();
  const arrayBuffer = await fetchTemplate(data.templateUrl);
  const dados: Record<string, string> = {
    nome_cliente: data.cliente.nome,
    rua: data.cliente.rua,
    numero: data.cliente.numero,
    bairro: data.cliente.bairro,
    cidade: data.cliente.cidade,
    uf: data.cliente.uf,
    cep: data.cliente.cep,
    documento: data.cliente.documento,
    qtd_modulos: String(data.qtdModulos),
    valor_total: formatCurrency(data.valorTotal),
    valor_total_limpeza: formatCurrency(data.valorTotal),
    valor_por_modulo: formatCurrency(data.valorMedio),
    valor_extenso: valorExtenso(data.valorTotal),
    forma_pagamento: 'A combinar',
    data_extenso: dataExtenso(now),
  };
  const blob = createDoc(arrayBuffer, dados);
  saveAs(blob, `Contrato_Limpeza_${data.cliente.nome.replace(/\s+/g, '_')}.docx`);
}

export async function gerarContratoMonitoramentoDocx(data: MonitoramentoContractData): Promise<void> {
  const now = new Date();
  const arrayBuffer = await fetchTemplate(data.templateUrl);
  const dados: Record<string, string> = {
    nome_cliente: data.cliente.nome,
    rua: data.cliente.rua,
    numero: data.cliente.numero,
    bairro: data.cliente.bairro,
    cidade: data.cliente.cidade,
    uf: data.cliente.uf,
    cep: data.cliente.cep,
    documento: data.cliente.documento,
    valor_mensal: formatCurrency(data.valorMensal),
    duracao_meses: String(data.duracaoMeses),
    valor_extenso: valorExtenso(data.valorMensal),
    duracao_extenso: duracaoExtenso(data.duracaoMeses),
    data_extenso: dataExtenso(now),
  };
  const blob = createDoc(arrayBuffer, dados);
  saveAs(blob, `Contrato_Monitoramento_${data.cliente.nome.replace(/\s+/g, '_')}.docx`);
}
