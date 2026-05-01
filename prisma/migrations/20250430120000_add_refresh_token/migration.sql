-- Tabla para refresh tokens opacos (Sprint 2).
CREATE TABLE IF NOT EXISTS refresh_token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP(6),
    CONSTRAINT refresh_token_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT refresh_token_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_usuario ON refresh_token (usuario_id);
