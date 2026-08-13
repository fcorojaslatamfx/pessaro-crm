// ─────────────────────────────────────────────────────────────────────────────
// generate-certificate — DESACTIVADA para el alumno (2026-08-13)
//
// Antes esta función permitía que el propio alumno se autoemitiera el certificado
// desde el portal: leía su user.id del JWT, comprobaba que hubiera completado el
// módulo e insertaba en education_certificates con la SERVICE ROLE KEY (que ignora
// RLS). Eso dejaba abierta una vía de emisión fuera del control del staff.
//
// Por decisión del 2026-08-13 la emisión de certificados es EXCLUSIVA del staff:
// se hace desde el CRM (Educación → Certificados, o la ficha del cliente) a través
// de la RPC issue_education_certificate(), que valida rol admin/super_admin y el
// 100 % de avance del alumno en el servidor.
//
// Se conserva el endpoint (en vez de borrarlo) para que el portal reciba un 403
// con un mensaje entendible en lugar de un 404 o un error de red.
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MENSAJE =
  "Los certificados los emite el equipo de Pessaro Capital una vez revisado tu avance. " +
  "Cuando completes el curso, tu asesor lo gestionará y te llegará por correo.";

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "self_issue_disabled",
      message: MENSAJE,
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(handler);
