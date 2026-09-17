-- Aplicar no SQL Editor do Supabase antes de publicar a funcionalidade.
BEGIN;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_codigo text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS desconto numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.clientes_com_compra (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primeira_compra_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cupons_reservados (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL UNIQUE,
  codigo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_com_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_reservados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clientes_com_compra, public.cupons_reservados FROM anon, authenticated;
GRANT ALL ON public.clientes_com_compra, public.cupons_reservados TO service_role;

-- Guarda o histórico mesmo quando o painel remove o pedido posteriormente.
CREATE OR REPLACE FUNCTION public.registrar_primeira_compra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.status IN ('Pago', 'Em Produção', 'Enviado', 'Concluído') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
    INSERT INTO public.clientes_com_compra(user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrar_primeira_compra ON public.pedidos;
CREATE TRIGGER registrar_primeira_compra AFTER INSERT OR UPDATE OF status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_primeira_compra();

INSERT INTO public.clientes_com_compra(user_id)
  SELECT DISTINCT user_id FROM public.pedidos
  WHERE user_id IS NOT NULL AND status IN ('Pago', 'Em Produção', 'Enviado', 'Concluído')
  ON CONFLICT (user_id) DO NOTHING;

-- Serializa duas tentativas de checkout do mesmo cliente.
CREATE OR REPLACE FUNCTION public.reservar_cupom_primeira_compra(
  p_user_id uuid, p_pedido_id uuid, p_codigo text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_codigo <> 'COMPRE.IJ' OR p_codigo IS NULL THEN
    RAISE EXCEPTION 'Cupom inválido';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.clientes_com_compra WHERE user_id = p_user_id) THEN
    RETURN 'cliente_existente';
  END IF;
  INSERT INTO public.cupons_reservados(user_id, pedido_id, codigo)
    VALUES (p_user_id, p_pedido_id, p_codigo) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 'ja_reservado'; END IF;
  RETURN 'reservado';
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_primeira_compra() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_cupom_primeira_compra(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_cupom_primeira_compra(uuid, uuid, text) TO service_role;

COMMIT;
