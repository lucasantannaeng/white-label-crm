import { Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SetupWizardProps {
  onSetupComplete: () => void;
}

export default function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl solar-gradient flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
          <Sun className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold mb-2">Bem-vindo ao</h1>
        <h2 className="font-display text-3xl font-bold solar-gradient-text mb-4">Solar Service CRM</h2>
        <p className="text-muted-foreground mb-8">
          Seu sistema de gestão para energia solar está pronto para uso. 
          As tabelas e funções já foram configuradas automaticamente.
        </p>
        <Button size="lg" className="w-full" onClick={onSetupComplete}>
          Acessar o Sistema
        </Button>
      </div>
    </div>
  );
}
