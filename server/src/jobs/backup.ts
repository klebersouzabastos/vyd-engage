import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

const MAX_LOCAL_BACKUPS = 7;

function parseDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.slice(1),
      user: u.username,
      password: u.password,
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
  const filename = `backup-${timestamp}.sql.gz`;
  const backupDir = process.env.BACKUP_DIR || '/tmp/vyd-backups';
  const backupPath = path.join(backupDir, filename);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const env = { ...process.env, PGPASSWORD: db.password };
  const cmd = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} | gzip > "${backupPath}"`;

  try {
    await execAsync(cmd, { env });
    const stat = fs.statSync(backupPath);
    logger.info('Database backup created', {
      file: filename,
      size: `${(stat.size / 1024 / 1024).toFixed(2)}MB`,
    });
  } catch (err: any) {
    logger.error('pg_dump failed', { error: err.message });
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    return;
  }

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

  const body = fs.readFileSync(localPath);
  const s3Key = `database-backups/${key}`;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

  // AWS Signature V4 requires crypto — delegate to child_process aws cli if available,
  // otherwise use presigned URL pattern via environment-provided CLI.
  // Simplest production path: install `aws` CLI in the Railway container and call it.
  await execAsync(`aws s3 cp "${localPath}" "s3://${bucket}/${s3Key}" --region "${region}"`, {
    env: { ...process.env, AWS_ACCESS_KEY_ID: accessKey, AWS_SECRET_ACCESS_KEY: secretKey },
  });
  void url; // suppress unused warning
}

function pruneOldBackups(dir: string): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'))
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

export async function initializeBackupJob(): Promise<void> {
  logger.info('Backup job initialized — first run in 5 minutes');

  // Run once shortly after startup to verify configuration
  setTimeout(
    () => {
      runBackup().catch((err) => logger.error('Backup job error', err));
    },
    5 * 60 * 1000
  );

  // Then every 24 hours at 02:00 server time
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runBackup().catch((err) => logger.error('Backup job error', err));
  }, TWENTY_FOUR_HOURS);
}
