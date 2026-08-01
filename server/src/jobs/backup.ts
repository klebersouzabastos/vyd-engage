import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

const execAsync = promisify(exec);

const MAX_LOCAL_BACKUPS = 7;

function parseDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      // URL() entrega componentes percent-encoded; decodifica para o pg_dump
      // (senha com caractere especial vinha errada no PGPASSWORD).
      database: decodeURIComponent(u.pathname.slice(1)),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    };
  } catch {
    return null;
  }
}

async function runBackup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn('Backup skipped: DATABASE_URL not set');
    return;
  }

  const db = parseDatabaseUrl(dbUrl);
  if (!db) {
    logger.error('Backup failed: cannot parse DATABASE_URL');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // Formato custom do pg_dump (-Fc): já comprimido, restaurável com pg_restore
  // (inclusive seletivo/paralelo). Elimina o pipe `| gzip` antigo, cujo exit
  // code era o do gzip — pg_dump podia falhar (binário ausente, versão
  // incompatível) e o job logava "backup created" com arquivo VAZIO (0.00MB),
  // como ocorreu em produção até 01/08/2026.
  const filename = `backup-${timestamp}.dump`;
  const backupDir = process.env.BACKUP_DIR || '/tmp/vyd-backups';
  const backupPath = path.join(backupDir, filename);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const env = { ...process.env, PGPASSWORD: db.password };
  // -w (--no-password): nunca esperar senha em stdin; timeout mata um pg_dump
  // pendurado (senão o setTimeout de agendamento nunca é rearmado e o job
  // morre em silêncio para sempre).
  const cmd = `pg_dump -Fc -w -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f "${backupPath}"`;

  try {
    await execAsync(cmd, { env, maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60_000 });
  } catch (err: any) {
    const detail = { error: err.message, stderr: String(err.stderr || '').slice(-500) };
    logger.error(
      '🚨 BACKUP FALHOU — produção está SEM backup até isto ser corrigido (verifique se o pg_dump existe no container e se a versão é >= à do servidor)',
      detail
    );
    captureException(err instanceof Error ? err : new Error(String(err)), {
      job: 'backup',
      stage: 'pg_dump',
      ...detail,
    });
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    return;
  }

  // Um dump real deste banco tem centenas de KB+; bem menos que isso é falha
  // disfarçada. Mantém o arquivo para diagnóstico (não apaga: um dump pequeno
  // porém válido ainda é melhor que backup nenhum).
  const MIN_BACKUP_BYTES = 10_000;
  const stat = fs.statSync(backupPath);
  if (stat.size < MIN_BACKUP_BYTES) {
    const msg = `Backup suspeito de vazio (${stat.size} bytes) — investigar pg_dump no container`;
    logger.error(`🚨 ${msg}`, { file: filename });
    captureException(new Error(msg), { job: 'backup', stage: 'size-check', file: filename });
    return;
  }

  logger.info('Database backup created', {
    file: filename,
    size: `${(stat.size / 1024 / 1024).toFixed(2)}MB`,
  });

  // Upload to S3 if configured
  const s3Bucket = process.env.BACKUP_S3_BUCKET;
  if (s3Bucket) {
    try {
      await uploadToS3(backupPath, s3Bucket, filename);
      fs.unlinkSync(backupPath);
      logger.info('Backup uploaded to S3 and local copy removed', {
        bucket: s3Bucket,
        key: filename,
      });
    } catch (err: any) {
      logger.error('S3 upload failed, keeping local backup', { error: err.message });
      captureException(err instanceof Error ? err : new Error(String(err)), {
        job: 'backup',
        stage: 's3-upload',
        bucket: s3Bucket,
      });
      // Cópia local permanece — poda para não acumular sem limite no disco.
      pruneOldBackups(backupDir);
    }
  } else {
    // Prune old local backups
    pruneOldBackups(backupDir);
  }
}

async function uploadToS3(localPath: string, bucket: string, key: string): Promise<void> {
  const region = process.env.BACKUP_S3_REGION || 'us-east-1';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for S3 upload');
  }

  const s3Key = `database-backups/${key}`;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

  // AWS Signature V4 requires crypto — delegate to child_process aws cli if available,
  // otherwise use presigned URL pattern via environment-provided CLI.
  // Simplest production path: install `aws` CLI in the Railway container and call it.
  await execAsync(
    `aws s3 cp --no-progress "${localPath}" "s3://${bucket}/${s3Key}" --region "${region}"`,
    {
      env: { ...process.env, AWS_ACCESS_KEY_ID: accessKey, AWS_SECRET_ACCESS_KEY: secretKey },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 15 * 60_000,
    }
  );
  void url; // suppress unused warning
}

function pruneOldBackups(dir: string): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.sql.gz') || f.endsWith('.dump')))
      .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    files.slice(MAX_LOCAL_BACKUPS).forEach((f) => {
      fs.unlinkSync(path.join(dir, f.name));
      logger.info('Old backup pruned', { file: f.name });
    });
  } catch (err: any) {
    logger.warn('Failed to prune old backups', { error: err.message });
  }
}

// Hora (UTC) da execução diária. Default 6 = 03:00 em Brasília. O pg_dump|gzip
// roda NESTE container e compete por CPU com a API — agendado por relógio de
// parede, de madrugada, e não "a cada 24h desde o boot" (que caía em horário
// comercial e congelava a UI p/ todos os usuários — incidente 29/07/2026).
const BACKUP_UTC_HOUR = parseInt(process.env.BACKUP_UTC_HOUR || '6', 10);

function msUntilNextRun(utcHour: number): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0, 0)
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export async function initializeBackupJob(): Promise<void> {
  const scheduleNext = () => {
    const delay = msUntilNextRun(BACKUP_UTC_HOUR);
    setTimeout(() => {
      runBackup()
        .catch((err) => logger.error('Backup job error', err))
        .finally(scheduleNext);
    }, delay);
    logger.info('Backup job scheduled', {
      utcHour: BACKUP_UTC_HOUR,
      nextRunInHours: (delay / 3_600_000).toFixed(1),
    });
  };
  scheduleNext();
}
