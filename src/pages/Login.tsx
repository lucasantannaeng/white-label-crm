import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sun, LogIn, UserPlus, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function logarComoMasterLocal(emailVal: string) {
    localStorage.setItem('SOLAR_MASTER_AUTH', 'true');
    localStorage.setItem('SOLAR_AUTH_EMAIL', emailVal);
    localStorage.setItem('SOLAR_AUTH_NOME', emailVal === 'adm@master.com' ? 'ADM (Master)' : 'Administrador Master');
    window.dispatchEvent(new Event('auth-state-changed'));
    toast.success('Bem-vindo, Administrador Master!');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // Special bypass for master testing
    if (cleanEmail === 'adm@master.com' && password === '123654') {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          // If remote supabase not available or credentials missing, log in via Master Session
          logarComoMasterLocal(cleanEmail);
        } else {
          toast.success('Login realizado com sucesso!');
        }
      } catch {
        logarComoMasterLocal(cleanEmail);
      }
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      try {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { nome: nome || 'Usuário' },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Conta criada com sucesso! Realizando login...');
          await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        }
      } catch (err: any) {
        toast.error('Erro de conexão: ' + (err.message || 'Verifique as credenciais'));
      }
    } else {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.success('Login realizado com sucesso!');
        }
      } catch (err: any) {
        toast.error('Erro ao conectar ao banco de autenticação.');
      }
    }
    setLoading(false);
  }

  function preencherMasterADM() {
    setEmail('adm@master.com');
    setPassword('123654');
    toast.info('Credenciais de ADM Master preenchidas! Clique em "Entrar no Sistema".');
  }

  function entrarDiretoMasterADM() {
    logarComoMasterLocal('adm@master.com');
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl solar-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <Sun className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Solar Service</h1>
          <p className="text-muted-foreground mt-1 text-sm">CRM de Energia Solar & Gestão Operacional</p>
        </div>

        <div className="glass-card rounded-xl p-6 border border-border/80 shadow-xl">
          <div className="flex gap-1 mb-6 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-1.5" />Entrar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-1.5" />Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label className="text-xs">Nome completo</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required className="mt-1" />
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
              {loading ? 'Autenticando...' : mode === 'login' ? 'Entrar no Sistema' : 'Criar Conta Master'}
            </Button>
          </form>

          {/* Quick Fill & Direct Login Buttons for Test ADM */}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <button
              type="button"
              onClick={entrarDiretoMasterADM}
              className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" /> Entrar Direto como ADM Master
            </button>
            <button
              type="button"
              onClick={preencherMasterADM}
              className="w-full py-1.5 px-3 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
            >
              Preencher campos (adm@master.com / 123654)
            </button>
          </div>

          {mode === 'login' && (
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error('Preencha o campo de email primeiro');
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) {
                  toast.error('Erro: ' + error.message);
                } else {
                  toast.success('Email de redefinição enviado! Verifique sua caixa de entrada.');
                }
              }}
              className="w-full text-xs text-primary hover:underline mt-3 text-center block"
            >
              Esqueceu a senha?
            </button>
          )}

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Perfil com Acesso Total (Master Admin)</span>
          </div>
        </div>
      </div>
    </main>
  );
}
