import nodemailer from 'nodemailer';
import { query } from './db';
import { NotificationLog, NotificationStatus } from '@/types';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Greenwood Provisions <orders@greenwoodprovisions.local>';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

const MAX_RETRY_ATTEMPTS = 3;

let mailTransporter: any = null;

function getTransporter(): any {
  if (!SMTP_HOST) {
    return null; // Simulated mode active
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  return mailTransporter;
}

export function isSmtpConfigured(): boolean {
  return !!SMTP_HOST;
}

/**
 * Queue a notification into the persistent outbox table in PostgreSQL
 */
export async function queueNotificationOutbox(
  entityType: 'ORDER' | 'ENQUIRY',
  entityId: string,
  recipient: string,
  subject: string,
  body: string,
  idempotencyKey?: string
): Promise<NotificationLog> {
  // Deduplication check
  if (idempotencyKey) {
    const existingRes = await query(
      'SELECT * FROM notification_logs WHERE idempotency_key = $1 LIMIT 1;',
      [idempotencyKey]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      return {
        id: existing.id,
        entityType: existing.entity_type,
        entityId: existing.entity_id,
        recipient: existing.recipient,
        subject: existing.subject,
        channel: existing.channel,
        status: existing.status,
        attempts: existing.attempts,
        errorMessage: existing.error_message,
        timestamp: typeof existing.timestamp === 'string' ? existing.timestamp : existing.timestamp.toISOString(),
      };
    }
  }

  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const initialStatus: NotificationStatus = 'PENDING';

  await query(`
    INSERT INTO notification_logs (
      id, entity_type, entity_id, recipient, subject, body,
      channel, status, attempts, error_message, idempotency_key, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, 'EMAIL', $7, 0, NULL, $8, $9);
  `, [
    id,
    entityType,
    entityId,
    recipient,
    subject,
    body,
    initialStatus,
    idempotencyKey || null,
    timestamp,
  ]);

  const log: NotificationLog = {
    id,
    entityType,
    entityId,
    recipient,
    subject,
    channel: 'EMAIL',
    status: initialStatus,
    attempts: 0,
    timestamp,
  };

  // Dispatch asynchronously without blocking caller
  setTimeout(() => {
    attemptDelivery(id).catch((err) => {
      console.error(`[Outbox] Delivery error for ${id}:`, err);
    });
  }, 10);

  return log;
}

/**
 * Attempt delivery for a given notification ID
 */
export async function attemptDelivery(notificationId: string): Promise<NotificationLog> {
  const selRes = await query('SELECT * FROM notification_logs WHERE id = $1;', [notificationId]);
  const row = selRes.rows[0];

  if (!row) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  const currentAttempts = (Number(row.attempts) || 0) + 1;
  const transporter = getTransporter();
  const nowIso = new Date().toISOString();

  // If SMTP is NOT configured, handle explicitly in SIMULATED mode
  if (!transporter) {
    const status: NotificationStatus = 'SIMULATED';
    const message = '[SIMULATED MODE] SMTP credentials not configured. Message simulated in development.';

    await query(`
      UPDATE notification_logs
      SET status = $1, attempts = $2, error_message = $3, timestamp = $4
      WHERE id = $5;
    `, [status, currentAttempts, message, nowIso, notificationId]);

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      recipient: row.recipient,
      subject: row.subject,
      channel: row.channel,
      status,
      attempts: currentAttempts,
      errorMessage: message,
      timestamp: nowIso,
    };
  }

  // Attempt genuine SMTP delivery
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: row.recipient,
      subject: row.subject,
      text: row.body || row.subject,
    });

    const status: NotificationStatus = 'DELIVERED';
    await query(`
      UPDATE notification_logs
      SET status = $1, attempts = $2, error_message = NULL, timestamp = $3
      WHERE id = $4;
    `, [status, currentAttempts, nowIso, notificationId]);

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      recipient: row.recipient,
      subject: row.subject,
      channel: row.channel,
      status,
      attempts: currentAttempts,
      timestamp: nowIso,
    };
  } catch (deliveryError: any) {
    const isExhausted = currentAttempts >= MAX_RETRY_ATTEMPTS;
    const status: NotificationStatus = isExhausted ? 'FAILED' : 'QUEUED';
    const errorMsg = `Delivery error: ${deliveryError?.message || 'Unknown network error'}`;

    await query(`
      UPDATE notification_logs
      SET status = $1, attempts = $2, error_message = $3, timestamp = $4
      WHERE id = $5;
    `, [status, currentAttempts, errorMsg, nowIso, notificationId]);

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      recipient: row.recipient,
      subject: row.subject,
      channel: row.channel,
      status,
      attempts: currentAttempts,
      errorMessage: errorMsg,
      timestamp: nowIso,
    };
  }
}

/**
 * Retry all failed notifications up to max attempts
 */
export async function retryFailedNotifications(): Promise<{ retried: number; results: NotificationLog[] }> {
  const failedRes = await query(
    'SELECT id FROM notification_logs WHERE status = $1 AND attempts < $2;',
    ['FAILED', MAX_RETRY_ATTEMPTS]
  );

  const results: NotificationLog[] = [];
  for (const r of failedRes.rows) {
    try {
      const res = await attemptDelivery(r.id);
      results.push(res);
    } catch {
      // ignore individual retry error
    }
  }

  return { retried: results.length, results };
}
