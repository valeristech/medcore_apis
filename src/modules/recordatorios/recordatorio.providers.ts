import type { FastifyBaseLogger } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import type { RecordatorioCanal } from './recordatorio.constants.js';

export type RecordatorioDispatchPayload = {
  canal: RecordatorioCanal;
  destino: string;
  asunto: string | null;
  cuerpo: string;
  cita_id: string;
  plantilla_id: string;
  organizacion_id: string;
};

export interface RecordatorioProvider {
  send(payload: RecordatorioDispatchPayload): Promise<void>;
}

/** Desarrollo / fallback: registra el mensaje en logs (sin proveedor externo). */
export class LogRecordatorioProvider implements RecordatorioProvider {
  constructor(private readonly log: FastifyBaseLogger) {}

  async send(payload: RecordatorioDispatchPayload): Promise<void> {
    this.log.info(
      {
        canal: payload.canal,
        destino: payload.destino,
        cita_id: payload.cita_id,
        plantilla_id: payload.plantilla_id,
      },
      `[recordatorio] ${payload.asunto ? `${payload.asunto} — ` : ''}${payload.cuerpo}`,
    );
  }
}

/** Webhook opcional para integrar Twilio, SendGrid, WhatsApp Business, etc. */
export class WebhookRecordatorioProvider implements RecordatorioProvider {
  constructor(
    private readonly url: string,
    private readonly secret: string | undefined,
    private readonly log: FastifyBaseLogger,
  ) {}

  async send(payload: RecordatorioDispatchPayload): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.secret) headers['X-Recordatorio-Secret'] = this.secret;

    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'recordatorio.enviado',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.warn({ status: res.status, body }, 'Webhook recordatorio respondió con error');
      throw new Error(`Webhook recordatorio falló (${res.status})`);
    }
  }
}

export function createRecordatorioProviders(
  env: AppEnv,
  log: FastifyBaseLogger,
): Record<RecordatorioCanal, RecordatorioProvider> {
  const logProvider = new LogRecordatorioProvider(log);
  const webhookUrl = env.RECORDATORIOS_WEBHOOK_URL;
  const webhookProvider = webhookUrl
    ? new WebhookRecordatorioProvider(webhookUrl, env.RECORDATORIOS_WEBHOOK_SECRET, log)
    : null;

  const pick = (): RecordatorioProvider =>
    webhookProvider ?? logProvider;

  return {
    whatsapp: pick(),
    sms: pick(),
    email: pick(),
  };
}
