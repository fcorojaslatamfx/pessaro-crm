-- ============================================================================
-- Migración: salas de documentos para invitados a reunión
-- Fecha: 2026-08-18
--
-- Objetivo: repartir documentos a los invitados de una reunión sin que el
-- archivo quede accesible por URL y sin obligarles a tener cuenta de nada. El
-- correo es el verificador: sólo quien está en la lista recibe un código de 6
-- dígitos, y sólo con ese código se descarga.
--
-- Modelo:
--   crm_doc_salas     → la reunión. Un enlace público por sala (public_token),
--                       que por sí solo NO da acceso a nada.
--   crm_doc_archivos  → los archivos, en el bucket privado crm-documentos.
--   crm_doc_invitados → la lista blanca. Sin fila aquí no hay acceso posible.
--   crm_doc_sesiones  → el OTP, calcado de support_otp_sessions: hash del
--                       código (nunca el código), intentos y caducidad.
--   crm_doc_accesos   → bitácora de descargas, con el ID que se estampa en el
--                       PDF. Es lo que permite saber de quién salió una copia.
--
-- Decisiones:
--   - El bucket es privado. La descarga va por enlace firmado de 60 s que
--     genera la edge function, nunca getPublicUrl().
--   - expires_at por defecto a 7 días: el material de una reunión no tiene por
--     qué seguir vivo un mes después.
--   - El email se guarda siempre en minúsculas (citext haría falta si no).
--   - crm_doc_sesiones se queda SIN políticas a propósito: sólo service role.
--     Es el mismo criterio que support_otp_sessions.
-- ============================================================================

-- ── Bucket privado ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-documentos', 'crm-documentos', false, 26214400,   -- 25 MB
  ARRAY[
    'application/pdf',
    'image/jpeg','image/png','image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- El staff sube y borra desde el CRM; los invitados NO tocan el bucket:
-- su descarga la firma la edge function con service role.
DROP POLICY IF EXISTS crm_documentos_staff_read   ON storage.objects;
CREATE POLICY crm_documentos_staff_read ON storage.objects
  FOR SELECT USING (bucket_id = 'crm-documentos' AND is_crm_staff());

DROP POLICY IF EXISTS crm_documentos_staff_write  ON storage.objects;
CREATE POLICY crm_documentos_staff_write ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'crm-documentos' AND is_crm_staff());

DROP POLICY IF EXISTS crm_documentos_staff_delete ON storage.objects;
CREATE POLICY crm_documentos_staff_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'crm-documentos' AND is_crm_staff());

-- ── Salas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_doc_salas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL,
  descripcion  text,
  -- Identifica la sala en el enlace. No es un secreto: la seguridad la da el
  -- OTP, no esta cadena, que viaja por correo y queda en bandejas ajenas.
  public_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  meeting_at   timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  -- Marca de agua con el correo y el ID de descarga (sólo aplica a PDF)
  watermark    boolean NOT NULL DEFAULT true,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_doc_salas_token_idx ON crm_doc_salas (public_token);

-- ── Archivos de la sala ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_doc_archivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id       uuid NOT NULL REFERENCES crm_doc_salas(id) ON DELETE CASCADE,
  file_path     text NOT NULL,               -- ruta dentro del bucket crm-documentos
  original_name text NOT NULL,
  mime_type     text,
  file_size     bigint,
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_doc_archivos_sala_idx ON crm_doc_archivos (sala_id);

-- ── Invitados: la lista blanca ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_doc_invitados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id         uuid NOT NULL REFERENCES crm_doc_salas(id) ON DELETE CASCADE,
  email           text NOT NULL,             -- siempre en minúsculas
  full_name       text,
  -- De dónde salió: normalmente un contacto de un grupo del CRM
  contact_id      uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  invite_sent_at  timestamptz,               -- cuándo se le mandó el enlace
  first_access_at timestamptz,               -- primera vez que verificó su correo
  CONSTRAINT crm_doc_invitados_sala_email_key UNIQUE (sala_id, email)
);

CREATE INDEX IF NOT EXISTS crm_doc_invitados_email_idx ON crm_doc_invitados (email);

-- ── Sesiones OTP ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_doc_sesiones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id       uuid NOT NULL REFERENCES crm_doc_salas(id) ON DELETE CASCADE,
  email         text NOT NULL,
  code_hash     text NOT NULL,               -- SHA-256, nunca el código en claro
  attempts      int  NOT NULL DEFAULT 0,     -- máx 5
  expires_at    timestamptz NOT NULL,        -- código: now() + 10 min
  verified_at   timestamptz,
  session_token text UNIQUE,                 -- emitido al verificar; TTL 1 h
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_doc_sesiones_token_idx ON crm_doc_sesiones (session_token);
CREATE INDEX IF NOT EXISTS crm_doc_sesiones_sala_email_idx ON crm_doc_sesiones (sala_id, email, created_at DESC);

-- ── Bitácora de descargas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_doc_accesos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id       uuid NOT NULL REFERENCES crm_doc_salas(id) ON DELETE CASCADE,
  archivo_id    uuid REFERENCES crm_doc_archivos(id)  ON DELETE SET NULL,
  invitado_id   uuid REFERENCES crm_doc_invitados(id) ON DELETE SET NULL,
  email         text NOT NULL,
  -- El mismo código que se estampa en el PDF. Si una copia se filtra, esto
  -- dice de qué descarga salió.
  download_code text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_doc_accesos_sala_idx ON crm_doc_accesos (sala_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_doc_accesos_code_idx ON crm_doc_accesos (download_code);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_doc_salas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_doc_archivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_doc_invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_doc_sesiones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_doc_accesos   ENABLE ROW LEVEL SECURITY;

-- El staff ve todas las salas (igual que la bandeja de soporte); modificarlas
-- queda para quien la creó y para el super admin.
DROP POLICY IF EXISTS crm_doc_salas_select ON crm_doc_salas;
CREATE POLICY crm_doc_salas_select ON crm_doc_salas
  FOR SELECT USING (is_crm_staff());

DROP POLICY IF EXISTS crm_doc_salas_insert ON crm_doc_salas;
CREATE POLICY crm_doc_salas_insert ON crm_doc_salas
  FOR INSERT WITH CHECK (is_crm_staff() AND created_by = auth.uid());

DROP POLICY IF EXISTS crm_doc_salas_update ON crm_doc_salas;
CREATE POLICY crm_doc_salas_update ON crm_doc_salas
  FOR UPDATE USING (created_by = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS crm_doc_salas_delete ON crm_doc_salas;
CREATE POLICY crm_doc_salas_delete ON crm_doc_salas
  FOR DELETE USING (created_by = auth.uid() OR is_super_admin());

-- Archivos, invitados y bitácora heredan el permiso de su sala
DROP POLICY IF EXISTS crm_doc_archivos_all ON crm_doc_archivos;
CREATE POLICY crm_doc_archivos_all ON crm_doc_archivos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM crm_doc_salas s WHERE s.id = crm_doc_archivos.sala_id
            AND (is_crm_staff()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM crm_doc_salas s WHERE s.id = crm_doc_archivos.sala_id
            AND (s.created_by = auth.uid() OR is_super_admin()))
  );

DROP POLICY IF EXISTS crm_doc_invitados_all ON crm_doc_invitados;
CREATE POLICY crm_doc_invitados_all ON crm_doc_invitados
  FOR ALL USING (
    EXISTS (SELECT 1 FROM crm_doc_salas s WHERE s.id = crm_doc_invitados.sala_id
            AND (is_crm_staff()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM crm_doc_salas s WHERE s.id = crm_doc_invitados.sala_id
            AND (s.created_by = auth.uid() OR is_super_admin()))
  );

-- La bitácora es sólo de lectura desde el CRM: la escribe la edge function
DROP POLICY IF EXISTS crm_doc_accesos_select ON crm_doc_accesos;
CREATE POLICY crm_doc_accesos_select ON crm_doc_accesos
  FOR SELECT USING (is_crm_staff());

-- crm_doc_sesiones: sin políticas → sólo service role (edge function)

COMMENT ON TABLE crm_doc_salas     IS 'Sala de documentos de una reunión. El enlace público no da acceso: hace falta OTP contra la lista de invitados.';
COMMENT ON TABLE crm_doc_invitados IS 'Lista blanca de correos. Sin fila aquí no hay acceso posible a la sala.';
COMMENT ON TABLE crm_doc_accesos   IS 'Bitácora de descargas. download_code es el ID estampado en el PDF.';
