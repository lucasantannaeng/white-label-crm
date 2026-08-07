import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sun, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Conta criada! Verifique seu email para confirmar.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Email ou senha incorretos');
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl solar-gradient flex items-center justify-center mx-auto mb-4">
            <Sun className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Solar Service</h1>
          <p className="text-muted-foreground mt-1">CRM de Energia Solar</p>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="flex gap-1 mb-6 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-1" />Entrar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-1" />Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label>Nome completo</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="pr-10" />
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

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
              className="w-full text-xs text-primary hover:underline mt-3"
            >
              Esqueceu a senha?
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            {mode === 'login' ? 'O primeiro cadastro recebe acesso de Administrador.' : 'Cadastros subsequentes recebem acesso de Técnico.'}
          </p>
        </div>
      </div>
    </main>
  );
}
