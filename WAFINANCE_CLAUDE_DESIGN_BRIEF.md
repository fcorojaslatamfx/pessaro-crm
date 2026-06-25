# 🎨 WAFinance — Brief para Claude Design

## Instrucciones de uso
Copia cada sección de este documento como prompt en Claude Design para generar los diseños. Están organizados en orden de prioridad.

---

## PROMPT 1: Icono / Logo de WAFinance

```
Diseña un icono/logo para "WAFinance por Pessaro Capital".

Concepto: El logo de Pessaro Capital (una X estilizada en azul navy y dorado) 
encerrado dentro de la silueta de un smartphone moderno.

Especificaciones:
- El smartphone debe ser una silueta minimalista, bordes redondeados
- Dentro del smartphone se ve el logo de Pessaro (X estilizada)
- Un globo de chat pequeño sale del smartphone (como indicador de mensaje)
- Colores: Navy (#0a1628), Púrpura (#6c5ce7), Dorado (#f0a500), Blanco
- Estilo: Moderno, fintech, profesional
- Debe funcionar en: favicon (16x16), icono PWA (192x192, 512x512), header del widget
- Variantes: fondo oscuro y fondo claro

Debajo del icono, el texto:
- "WAFinance" en Inter Bold, color navy
- "por Pessaro Capital" en Inter Regular, tamaño menor, color gris

Referencia de marca: https://pessaro.cl (ver logo y colores del sitio)
```

---

## PROMPT 2: Widget de chat público (vista del visitante — mobile)

```
Diseña una interfaz de chat en vivo para mobile (375x812px) llamada "WAFinance por Pessaro Capital".

Es la página que ve un contacto cuando abre el link crm.pessaro.cl/chat/ALE7P

Pantalla 1 — Registro con verificación OTP:
- Header: icono WAFinance + "WAFinance" + "por Pessaro Capital"
- Foto y nombre del asesor asignado (ej: "Alejandra Peña Ortega")
- Badge: "Asesor · Pessaro Capital"
- Mensaje de bienvenida: "Hola, soy Alejandra. Verifica tu identidad para iniciar el chat."
- Formulario con 3 campos obligatorios:
  - Nombre completo (icono persona)
  - Email (icono sobre)
  - Teléfono móvil (icono teléfono, formato +56 9 XXXX XXXX)
- Botón primario: "Verificar mi email →" (dorado #f0a500)
- Texto pequeño: "Te enviaremos un código de 6 dígitos a tu correo"
- Footer: "Powered by Pessaro Capital · pessaro.cl"

Pantalla 2 — Verificación OTP:
- Misma estructura de header
- Texto: "Ingresa el código enviado a tu***@email.com"
- 6 campos individuales para cada dígito (estilo bancario, grandes, centrados)
- Timer countdown: "Expira en 4:32"
- Link: "¿No recibiste el código? Reenviar"
- Botón: "Confirmar →"
- Indicador de intentos: "Intento 1 de 3"

Pantalla 3 — Chat activo (post-verificación):
- Header fijo: foto asesor + nombre + indicador "En línea" (punto verde) o "Responde en ~5 min"
- Badge de verificación: ✅ junto al nombre del visitante
- Área de mensajes: burbujas estilo WhatsApp/iMessage
  - Mensajes del visitante: alineados a la derecha, fondo púrpura (#6c5ce7), texto blanco
  - Mensajes del asesor: alineados a la izquierda, fondo gris oscuro (#1e293b), texto blanco
  - Timestamps discretos debajo de cada burbuja
  - Primer mensaje automático del sistema: "✅ Identidad verificada. Alejandra ha sido notificada."
- Input fijo abajo: campo de texto + botón enviar (icono flecha)
- Indicador "escribiendo..." cuando el asesor responde

Estilo visual:
- Fondo: degradado sutil navy (#0a1628) → navy claro (#0f2447)
- Bordes redondeados en todo (12px)
- Sombras sutiles en las burbujas
- Tipografía: Inter
- Animaciones: burbujas aparecen con fade-in suave
- Los campos OTP deben verse premium (como verificación bancaria)
- Debe verse premium, como un producto fintech de primera línea
- NO debe parecer un chatbot genérico, debe sentirse como chat directo con una persona real
```

---

## PROMPT 3: Widget de chat público (vista del visitante — desktop)

```
Diseña la misma interfaz de chat WAFinance pero para desktop.

Dos opciones:

Opción A — Página completa (crm.pessaro.cl/chat/ALE7P):
- Layout centrado, max-width 480px
- Fondo de página: patrón sutil o gradient navy
- Card central con el chat (como una app de mensajería embebida)
- Sidebar izquierdo o header con info del asesor

Opción B — Widget flotante (embeddable):
- Botón flotante esquina inferior derecha (icono WAFinance)
- Al hacer clic: se expande un panel de chat (360x520px)
- Transición suave de expansión
- Puede cerrarse/minimizarse

Mismos colores y estilo que la versión mobile:
- Navy (#0a1628), Púrpura (#6c5ce7), Dorado (#f0a500)
- Inter font
- Burbujas estilo mensajería
```

---

## PROMPT 4: Vista CRM del asesor (inbox de chats)

```
Diseña la vista del asesor dentro del CRM Pessaro Capital para gestionar chats de WAFinance.

Contexto: El CRM tiene un estilo dark theme con fondo navy (#0a1628), 
superficies en glass morphism, y acentos en púrpura (#6c5ce7).

La vista puede ser:
- Una nueva pestaña "💬 Chat en vivo" en el sidebar del CRM
- O un tab dentro de "Mensajes WA" existente

Layout (similar al inbox de WhatsApp que ya existe en el CRM):

Panel izquierdo — Lista de conversaciones:
- Buscador arriba
- Cada conversación muestra: nombre visitante, último mensaje (preview), 
  hora, badge "nuevo" si no leído, indicador de canal "WAFinance" (vs WhatsApp)
- Separador: "Activas" y "Cerradas"
- Badge con contador de no leídos

Panel derecho — Chat abierto:
- Header: nombre del visitante + email/teléfono + botón "Cerrar chat"
- Área de mensajes (mismo estilo burbujas)
- Input de texto + botón enviar
- Botón para convertir visitante en contacto CRM (+"Agregar a contactos")

Estilo: Consistente con el CRM existente (dark theme, GlassCard, Inter font)
```

---

## PROMPT 5: Notificación push

```
Diseña la notificación push que recibe el asesor cuando un visitante envía un mensaje por WAFinance.

Formato: notificación del sistema (desktop y mobile)

Desktop:
- Icono: WAFinance (smartphone con logo Pessaro)
- Título: "WAFinance · Nuevo mensaje"
- Cuerpo: "Juan Pérez: Hola, me interesa información sobre..."
- Acciones: "Responder" | "Ver en CRM"

Mobile (PWA):
- Mismo contenido adaptado a notificación mobile
- Al tocar: abre el CRM en la conversación

Toast dentro del CRM (similar al que ya existe para WhatsApp):
- Aparece esquina inferior derecha
- Muestra nombre + preview del mensaje
- Botón "Ver" que navega a la conversación
- Auto-dismiss en 8 segundos
```

---

## PROMPT 6: Email de verificación OTP (plantilla Resend)

```
Diseña el email que recibe el visitante con su código OTP de verificación 
para WAFinance por Pessaro Capital.

Estructura:
- Header: gradient navy → azul con logo Pessaro + "WAFinance"
- Saludo: "Hola [Nombre],"
- Texto: "Tu código de verificación para iniciar el chat con [Nombre Asesor] es:"
- Código OTP grande: 6 dígitos en cajas individuales, fuente monospace, 
  tamaño 32px, fondo gris claro, borde azul, espaciados
  Ejemplo: [4] [7] [2] [9] [1] [5]
- Alerta: "Este código expira en 5 minutos"
- Nota: "Si no solicitaste este código, ignora este email."
- Footer: mismo que los emails actuales del CRM 
  (info@pessaro.cl · +56 9 2207 1511 · © 2026 pessaro.cl)

Colores: consistente con emails existentes del CRM
- Header gradient: #0a1628 → #1a3a6b
- Botones/acentos: #f0a500 (dorado)
- Texto: #2d3748
- Footer: #0a1628

Ancho: 560px (mismo que las plantillas actuales)
Responsivo para mobile
```

---

## Paleta de colores de referencia

```
Navy (fondo):        #0a1628
Navy claro:          #0f2447
Superficie:          #111b2e
Borde:               #1e293b
Púrpura:             #6c5ce7
Púrpura dim:         #6c5ce720
Dorado:              #f0a500
Verde (en línea):    #10b981
Azul:                #3b82f6
Rojo:                #ef4444
Naranja:             #f59e0b
Texto principal:     #e8ecf4
Texto secundario:    #a0aec0
Muted:               #64748b
```

## Assets existentes

```
Logo Pessaro:        https://pessaro.cl/images/logo-256.webp
Sitio público:       https://pessaro.cl
CRM:                 https://crm.pessaro.cl (dark theme de referencia)
```
