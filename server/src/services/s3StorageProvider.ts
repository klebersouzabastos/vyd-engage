/**
 * s3StorageProvider — provider S3-compatível (req 22, Upgrade RD P2).
 *
 * Implementa put/get/remove reais sobre `@aws-sdk/client-s3`. É S3-compatível
 * (AWS S3, Cloudflare R2, MinIO, Backblaze B2…) via `endpoint` custom + region +
 * bucket + credenciais, todos configuráveis por env STORAGE_S3_*:
 *
 *   STORAGE_S3_BUCKET             (obrigatório p/ ativar o provider)
 *   STORAGE_S3_ACCESS_KEY_ID      (obrigatório)
 *   STORAGE_S3_SECRET_ACCESS_KEY  (obrigatório)
 *   STORAGE_S3_REGION             (default "auto" — R2 usa "auto")
 *   STORAGE_S3_ENDPOINT           (opcional — necessário p/ R2/MinIO; ausente = AWS)
 *   STORAGE_S3_FORCE_PATH_STYLE   ("true" p/ MinIO/alguns; default false)
 *
 * GATING GRACIOSO: `isS3Configured()` só é true quando bucket+chaves existem.
 * O storageService faz fallback para o provider "db" quando não configurado ou
 * em qualquer falha de escrita — nunca 500 por ausência de credencial.
 *
 * Chave do objeto: `${tenantId}/${uuid}` — isola por tenant e evita colisão.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

/** True quando o provider "s3" está configurado por env (bucket + chaves). */
export function isS3Configured(): boolean {
  return Boolean(
    process.env.STORAGE_S3_BUCKET &&
      process.env.STORAGE_S3_ACCESS_KEY_ID &&
      process.env.STORAGE_S3_SECRET_ACCESS_KEY
  );
}

let cachedClient: S3Client | null = null;

/**
 * Cliente S3 memoizado, montado a partir das env STORAGE_S3_*. Compatível com R2
 * (endpoint custom + region "auto"). O cache é limpo por `resetS3Client()` (testes).
 */
function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  const region = process.env.STORAGE_S3_REGION || 'auto';
  const endpoint = process.env.STORAGE_S3_ENDPOINT || undefined;
  const forcePathStyle = process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true';

  cachedClient = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    credentials: {
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY as string,
    },
  });
  return cachedClient;
}

/** Limpa o cliente memoizado (usado em testes ao trocar env). */
export function resetS3Client(): void {
  cachedClient = null;
}

function bucket(): string {
  return process.env.STORAGE_S3_BUCKET as string;
}

/**
 * Persiste o objeto e retorna a `storageKey` (object key) — usada como storageKey
 * do Attachment quando provider="s3".
 */
export async function putObject(
  tenantId: string,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const key = `${tenantId}/${randomUUID()}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Metadado informativo (nome original sanitizado) — não confiável p/ segurança.
      Metadata: { 'original-name': encodeURIComponent(name) },
    })
  );
  return key;
}

/** Lê os bytes do objeto pela sua storageKey. */
export async function getObject(key: string): Promise<Buffer> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );
  const body = res.Body as
    | { transformToByteArray?: () => Promise<Uint8Array> }
    | undefined;
  if (!body || typeof body.transformToByteArray !== 'function') {
    throw new Error('Resposta S3 sem corpo legível.');
  }
  return Buffer.from(await body.transformToByteArray());
}

/** Remove o objeto pela sua storageKey (best-effort no expurgo definitivo). */
export async function removeObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
