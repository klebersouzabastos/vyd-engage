-- Índice ANN para a busca semântica de atestados (RAG).
--
-- A busca em ragService.semanticSearch ordena por distância de cosseno
-- (`embedding <=> $1::vector`); sem índice, cada consulta é um seq scan sobre
-- atestado_chunks — ok com acervo pequeno, degrada linearmente com o volume.
-- HNSW (pgvector >= 0.5; prod está em 0.8.2) com vector_cosine_ops casa com o
-- operador usado. Linhas com embedding NULL não entram no índice.
-- Parâmetros m/ef_construction ficam no default (16/64), adequados à escala
-- atual; recriar com valores maiores se o acervo passar de ~1M chunks.

-- Falha rápida em caso de lock concorrente (tabela é pequena; o build do
-- índice em si é rápido — lock_timeout só afeta a espera pelo lock).
SET lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS "atestado_chunks_embedding_idx"
  ON "atestado_chunks" USING hnsw ("embedding" vector_cosine_ops);
