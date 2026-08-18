// ===== MASKS =====
export function maskCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

// ===== FORMAT =====
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    // If date-only string (YYYY-MM-DD), parse as local to avoid timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
    }
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

// ===== NÚMERO POR EXTENSO =====
const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function grupoExtenso(n: number): string {
  if (n <= 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const d = Math.floor(r / 10);
  const u = r % 10;

  const parts: string[] = [];
  if (c > 0 && c < centenas.length) parts.push(centenas[c]);
  if (r > 0 && r < 20) {
    parts.push(unidades[r]);
  } else if (r >= 20) {
    if (u > 0) parts.push(dezenas[d] + ' e ' + unidades[u]);
    else parts.push(dezenas[d]);
  }
  return parts.join(' e ');
}

export function numeroExtenso(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0) return 'menos ' + numeroExtenso(Math.abs(n));

  const bilhoes = Math.floor(n / 1_000_000_000);
  let resto = n % 1_000_000_000;
  const milhoes = Math.floor(resto / 1_000_000);
  resto = resto % 1_000_000;
  const milhares = Math.floor(resto / 1_000);
  const unidadesResto = resto % 1_000;

  const blocos: string[] = [];

  if (bilhoes > 0) {
    blocos.push(bilhoes === 1 ? 'um bilhão' : grupoExtenso(bilhoes) + ' bilhões');
  }

  if (milhoes > 0) {
    blocos.push(milhoes === 1 ? 'um milhão' : grupoExtenso(milhoes) + ' milhões');
  }

  if (milhares > 0) {
    blocos.push(milhares === 1 ? 'mil' : grupoExtenso(milhares) + ' mil');
  }

  if (unidadesResto > 0) {
    blocos.push(grupoExtenso(unidadesResto));
  }

  if (blocos.length === 1) return blocos[0];
  
  // Concatena blocos usando ' e ' para o último se for < 100 ou centena redonda
  if (unidadesResto > 0 && (unidadesResto <= 100 || unidadesResto % 100 === 0)) {
    const ultimo = blocos.pop()!;
    return blocos.join(', ') + ' e ' + ultimo;
  }

  return blocos.join(' e ');
}

export function valorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  let texto = '';
  if (inteiro > 0) {
    texto = numeroExtenso(inteiro) + (inteiro === 1 ? ' real' : ' reais');
  }
  if (centavos > 0) {
    if (inteiro > 0) texto += ' e ';
    texto += numeroExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }
  if (inteiro === 0 && centavos === 0) texto = 'zero reais';
  // Capitalize first letter
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function duracaoExtenso(meses: number): string {
  return numeroExtenso(meses) + (meses === 1 ? ' mês' : ' meses');
}

export function dataExtenso(date: Date): string {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatWhatsAppUrl(telefone?: string | null, text?: string): string {
  if (!telefone) return '';
  const digits = telefone.replace(/\D/g, '');
  if (!digits) return '';
  let fullNum = digits;
  // Brazilian numbers with DDD (10 or 11 digits) need DDI 55
  if (digits.length === 10 || digits.length === 11) {
    fullNum = `55${digits}`;
  } else if (!digits.startsWith('55') && digits.length < 12) {
    fullNum = `55${digits}`;
  }
  const base = `https://wa.me/${fullNum}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
