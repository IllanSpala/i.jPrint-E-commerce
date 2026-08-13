-- Execute este SQL no Dashboard do Supabase (SQL Editor)
-- Cria a tabela de carrinhos salvos para recuperação de carrinho abandonado

CREATE TABLE IF NOT EXISTS carrinhos_salvos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  itens jsonb NOT NULL DEFAULT '[]',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  email_enviado boolean NOT NULL DEFAULT false,
  email_enviado_em timestamptz
);

-- Garante apenas 1 carrinho por usuário (upsert pelo user_id)
CREATE UNIQUE INDEX IF NOT EXISTS carrinhos_salvos_user_id_idx ON carrinhos_salvos (user_id);

-- RLS: usuário pode ver e editar só o próprio carrinho
ALTER TABLE carrinhos_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprio carrinho" ON carrinhos_salvos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuário upsert próprio carrinho" ON carrinhos_salvos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza próprio carrinho" ON carrinhos_salvos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuário apaga próprio carrinho" ON carrinhos_salvos
  FOR DELETE USING (auth.uid() = user_id);
