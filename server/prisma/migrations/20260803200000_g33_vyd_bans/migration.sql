-- VYD ID G.33 (propagacao de ban) + Onda 4 (verbo logout) — lado do Engage.
--
-- vyd_bans e chaveada por E-MAIL, nao por userId: o ban precisa valer para
-- quem ainda NAO tem conta local. Sem isso, banir alguem que nunca entrou no
-- Engage seria no-op e o primeiro SSO dele passaria. Licao aprendida no
-- Finance em 18/07 (migration g33_ban_email_only), replicada aqui de saida.
--
-- vyd_ban_nonces e o anti-replay do webhook: a janela de 5min do `ts` sozinha
-- deixaria a mesma requisicao assinada ser reenviada dentro dela.

CREATE TABLE "vyd_bans" (
    "email"    TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL,
    "reason"   TEXT,

    CONSTRAINT "vyd_bans_pkey" PRIMARY KEY ("email")
);

CREATE TABLE "vyd_ban_nonces" (
    "nonce"  TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vyd_ban_nonces_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "vyd_ban_nonces_seenAt_idx" ON "vyd_ban_nonces"("seenAt");

-- Marca d'agua do verbo `logout`. O Engage TEM sessao persistida
-- (RefreshToken), entao logout = apagar as linhas do usuario; esta coluna
-- existe para o access token de 15min tambem morrer na hora, sem esperar
-- expirar. Mesmo desenho da 041 do BIM.
ALTER TABLE "User" ADD COLUMN "tokensValidAfter" TIMESTAMP(3);
