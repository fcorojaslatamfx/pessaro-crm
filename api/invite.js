// Sirve meta tags OG dinámicos para la invitación WAFinance y redirige al chat real.
// WhatsApp/bots leen los meta (no ejecutan JS); humanos son redirigidos a /chat/{code}.
export default function handler(req, res) {
  const { code = '', img = '' } = req.query
  const n = /^[1-5]$/.test(String(img)) ? String(img) : null
  const storage = 'https://ldlflxujrjihiybrcree.supabase.co/storage/v1/object/public/public-assets'
  const image = n ? `${storage}/wafinance${n}.jpg` : `${storage}/og-wafinance.jpg`
  const safeCode = String(code).replace(/[^A-Za-z0-9]/g, '')
  const target = `https://crm.pessaro.cl/chat/${safeCode}`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200).send(`<!doctype html><html lang="es"><head>
<meta charset="utf-8">
<title>WAFinance — Asesoría Financiera Exclusiva | Pessaro Capital</title>
<meta property="og:title" content="WAFinance — Asesoría Financiera Exclusiva | Pessaro Capital">
<meta property="og:description" content="Chat privado con asesor profesional certificado. Asesoría financiera integral y personal, sin compromiso.">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${target}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0;url=${target}">
</head><body>Redirigiendo a tu chat…</body></html>`)
}
