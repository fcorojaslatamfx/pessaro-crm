# Pessaro CRM - Master Branch

## Stack & Entorno
- Entorno de Producción: crm.pessaro.cl
- Gestor de Paquetes: npm (package-lock.json)
- Tecnologías: TypeScript (.ts, .tsx), React

## Comandos Críticos
- Desarrollo: npm run dev
- Validar Tipos: npx tsc --noEmit
- Construcción de Producción: npm run build

## Reglas Estrictas de Optimización
- Optimizar la carga de tableros (dashboards), gráficos y tablas de datos pesadas.
- Implementar Code-Splitting con React.lazy para vistas secundarias del CRM.
- No alterar las llamadas de las API ni la estructura de datos existente.
- Cero tolerancia a errores de TypeScript; el build debe compilar al 100%.
