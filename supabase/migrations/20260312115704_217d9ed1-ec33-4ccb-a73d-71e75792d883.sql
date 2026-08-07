
CREATE OR REPLACE FUNCTION public.calcular_valores_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  -- Calcula valor_mensal com base nas faixas de monitoramento
  SELECT valor INTO rec FROM faixas_preco 
    WHERE tipo = 'monitoramento' 
      AND NEW.kwh_mensal >= faixa_inicio 
      AND (faixa_fim IS NULL OR NEW.kwh_mensal <= faixa_fim)
    LIMIT 1;
  
  IF rec IS NOT NULL THEN
    NEW.valor_mensal := rec.valor;
  ELSE
    NEW.valor_mensal := 0;
  END IF;

  IF NEW.inicio_contrato IS NOT NULL AND NEW.duracao_meses IS NOT NULL THEN
    NEW.termino_contrato := NEW.inicio_contrato + (NEW.duracao_meses || ' months')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$function$;
