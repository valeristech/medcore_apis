-- UC-AGE-005: seguimiento de recordatorios enviados por cita y plantilla
CREATE TABLE "cita_recordatorio_envio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cita_id" UUID NOT NULL,
    "plantilla_recordatorio_id" UUID NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "destino" VARCHAR(200),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'enviado',
    "error_mensaje" TEXT,
    "enviado_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_recordatorio_envio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_cita_recordatorio_envio" ON "cita_recordatorio_envio"("cita_id", "plantilla_recordatorio_id");
CREATE INDEX "idx_cita_recordatorio_envio_cita" ON "cita_recordatorio_envio"("cita_id");
CREATE INDEX "idx_cita_recordatorio_envio_plantilla" ON "cita_recordatorio_envio"("plantilla_recordatorio_id");

ALTER TABLE "cita_recordatorio_envio" ADD CONSTRAINT "cita_recordatorio_envio_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "cita_recordatorio_envio" ADD CONSTRAINT "cita_recordatorio_envio_plantilla_recordatorio_id_fkey" FOREIGN KEY ("plantilla_recordatorio_id") REFERENCES "plantilla_recordatorio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
