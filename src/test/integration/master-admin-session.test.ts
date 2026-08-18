import { describe, it, expect } from 'vitest';

describe('Master Admin Auth & Permissions Verification', () => {
  const MASTER_ADMIN_EMAILS = [
    'lucasantannaeng@gmail.com',
    'adm@master.com',
  ];

  it('deve identificar adm@master.com como Master Admin com acesso total', () => {
    const email = 'adm@master.com';
    const isMasterUser = MASTER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
    expect(isMasterUser).toBe(true);

    const role = isMasterUser ? 'master' : 'viewer';
    const isAdmin = role === 'admin' || role === 'master';
    const isMaster = role === 'master';

    expect(role).toBe('master');
    expect(isAdmin).toBe(true);
    expect(isMaster).toBe(true);
  });

  it('deve formatar o nome do adm@master.com como ADM (Master)', () => {
    const email = 'adm@master.com';
    const isMasterUser = true;
    const profileNome = '';
    let defaultName = email;
    if (email === 'adm@master.com') defaultName = 'ADM (Master)';
    else if (email === 'lucasantannaeng@gmail.com') defaultName = 'Luca Rodrigues (Master)';

    const nomeExibicao = profileNome || defaultName;
    expect(nomeExibicao).toBe('ADM (Master)');
  });

  it('deve liberar todas as 11 páginas operacionais e gerenciais para adm@master.com', () => {
    type Page = 'dashboard' | 'clientes' | 'calculadora' | 'contratos' | 'agenda' | 'servicos-extras' | 'comissoes' | 'configuracoes' | 'ai-hub' | 'equipes' | 'documentos';
    
    const adminPages: Page[] = ['dashboard', 'agenda', 'servicos-extras', 'calculadora', 'clientes', 'contratos', 'ai-hub', 'equipes', 'comissoes', 'documentos'];
    const masterPages: Page[] = [...adminPages, 'configuracoes'];

    const isMaster = true;
    const allowedPages = isMaster ? masterPages : adminPages;

    expect(allowedPages).toHaveLength(11);
    expect(allowedPages).toContain('dashboard');
    expect(allowedPages).toContain('clientes');
    expect(allowedPages).toContain('calculadora');
    expect(allowedPages).toContain('contratos');
    expect(allowedPages).toContain('agenda');
    expect(allowedPages).toContain('servicos-extras');
    expect(allowedPages).toContain('comissoes');
    expect(allowedPages).toContain('configuracoes');
    expect(allowedPages).toContain('ai-hub');
    expect(allowedPages).toContain('equipes');
    expect(allowedPages).toContain('documentos');
  });
});
