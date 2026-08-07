import React, { useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  maskFn: (value: string) => string;
  value: string;
  onChange: (value: string) => void;
  maxRaw?: number;
}

export default function MaskedInput({ maskFn, value, onChange, maxRaw, ...props }: MaskedInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (maxRaw && raw.length > maxRaw) return;
    onChange(maskFn(e.target.value));
  }, [maskFn, onChange, maxRaw]);

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
    />
  );
}
