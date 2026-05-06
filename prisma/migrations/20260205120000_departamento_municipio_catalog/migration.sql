-- Catálogos departamento / municipio por organización y FK opcional en paciente.

CREATE TABLE "departamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizacion_id" UUID NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "departamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departamento_organizacion_id_codigo_key" ON "departamento"("organizacion_id", "codigo");
CREATE INDEX "idx_departamento_org" ON "departamento"("organizacion_id");

ALTER TABLE "departamento" ADD CONSTRAINT "departamento_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "municipio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizacion_id" UUID NOT NULL,
    "departamento_id" UUID NOT NULL,
    "codigo" VARCHAR(15) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "municipio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "municipio_departamento_id_codigo_key" ON "municipio"("departamento_id", "codigo");
CREATE INDEX "idx_municipio_org" ON "municipio"("organizacion_id");
CREATE INDEX "idx_municipio_depto" ON "municipio"("departamento_id");

ALTER TABLE "municipio" ADD CONSTRAINT "municipio_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "municipio" ADD CONSTRAINT "municipio_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "paciente" ADD COLUMN IF NOT EXISTS "municipio_id" UUID;
ALTER TABLE "paciente" DROP COLUMN IF EXISTS "municipio";
ALTER TABLE "paciente" DROP COLUMN IF EXISTS "departamento";

ALTER TABLE "paciente" DROP CONSTRAINT IF EXISTS "paciente_municipio_id_fkey";
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
