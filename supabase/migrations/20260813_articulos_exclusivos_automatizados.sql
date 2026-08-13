-- ─────────────────────────────────────────────────────────────────────────────
-- Artículos exclusivos automatizados, con fuentes citadas
-- Fecha: 2026-08-13
--
-- Contexto: la tabla client_exclusive_articles_2026_03_11 sólo tenía 4 filas
-- sembradas en marzo de 2026, firmadas por analistas que no son personas reales
-- del equipo, y con el cuerpo (`content`) que el portal nunca llegó a renderizar.
-- Pasa a alimentarse de un orquestador —generar-articulos-referencias— que
-- redacta comentario propio de Pessaro sobre noticias reales.
--
-- Principio de diseño, el mismo del análisis diario de instrumentos:
-- **las fuentes no las inventa el modelo**. El orquestador lee feeds RSS reales,
-- extrae titular, medio, URL y fecha de cada noticia, y guarda esos registros
-- literalmente como vienen del feed. Al modelo se le pasan como material y sólo
-- redacta el comentario. Una URL de un medio financiero inventada por el modelo,
-- publicada a clientes de una firma de asesoría, es peor que no tener artículo.
--
-- Nota de derechos: se cita y se enlaza —titular, medio, fecha y enlace—, nunca
-- se reproduce el texto de la nota original. El comentario es obra propia.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Trazabilidad y fuentes ───────────────────────────────────────────────
alter table public.client_exclusive_articles_2026_03_11
  add column if not exists sources      jsonb not null default '[]'::jsonb,
  add column if not exists generated_at timestamptz,
  add column if not exists generated_by text,
  add column if not exists validacion   jsonb not null default '{}'::jsonb;

-- Requisito legal, idéntico al de analisis_instrumentos: el aviso de carácter
-- educativo viaja en la fila, no en un pie de página del portal.
alter table public.client_exclusive_articles_2026_03_11
  add column if not exists disclaimer text not null default
    'Este artículo tiene carácter exclusivamente educativo e informativo. No constituye asesoría de inversión, recomendación de compra o venta, ni oferta de instrumentos financieros. Las fuentes citadas son de terceros y su contenido es responsabilidad de cada medio. Invertir en mercados financieros conlleva riesgo de pérdida de capital. Pessaro Capital SpA no garantiza resultados.';

do $$ begin
  alter table public.client_exclusive_articles_2026_03_11
    add constraint articulos_disclaimer_presente
    check (length(btrim(disclaimer)) >= 80);
exception when duplicate_object then null; end $$;

-- Un artículo generado por el orquestador sin ninguna fuente no tiene sentido:
-- su razón de ser es comentar noticias reales y enlazarlas. Los artículos
-- cargados a mano (generated_by null) quedan fuera de la regla.
do $$ begin
  alter table public.client_exclusive_articles_2026_03_11
    add constraint articulos_generados_con_fuentes
    check (generated_by is null or jsonb_array_length(sources) >= 1);
exception when duplicate_object then null; end $$;

comment on column public.client_exclusive_articles_2026_03_11.sources is
  'Noticias citadas, como vienen del feed: [{titulo, medio, url, fecha}]. Nunca las escribe el modelo.';
comment on column public.client_exclusive_articles_2026_03_11.generated_by is
  'Orquestador que publicó la fila; null si la cargó una persona.';
comment on column public.client_exclusive_articles_2026_03_11.validacion is
  'Comprobaciones superadas antes de publicar (longitud, fuentes, lenguaje prohibido).';

-- ── 2. Firma institucional ──────────────────────────────────────────────────
-- El contenido lo redacta un modelo sobre fuentes reales y la firma editorial la
-- asume la empresa. Atribuirlo a un analista con nombre y apellido sería inventar
-- una persona, que es justo el problema de las filas de marzo.
alter table public.client_exclusive_articles_2026_03_11
  alter column author_name set default 'Pessaro Capital',
  alter column author_role set default 'Equipo de Análisis';

-- ── 3. Retirar la siembra de marzo ──────────────────────────────────────────
-- Las 4 filas de prueba van firmadas por analistas que no son del equipo y sus
-- referencias de mercado tienen cinco meses. Se despublican; las filas quedan en
-- la tabla por si se quieren de referencia.
update public.client_exclusive_articles_2026_03_11
set is_published = false,
    updated_at   = now()
where is_published = true
  and generated_by is null
  and published_at < '2026-04-01';

-- ── 4. Índice para el listado y el histórico ────────────────────────────────
create index if not exists client_exclusive_articles_publicados_idx
  on public.client_exclusive_articles_2026_03_11 (is_published, published_at desc);
