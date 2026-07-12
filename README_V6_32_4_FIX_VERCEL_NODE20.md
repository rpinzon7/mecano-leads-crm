# V6.32.4 Fix Vercel Node 20

Corrección de despliegue para Vercel.

## Cambios

- Se agregó `.nvmrc` con Node 20.
- Se agregó `engines` en `package.json` para forzar Node 20.x y npm 10.x.
- Se actualizó `package-lock.json` para dejar URLs públicas de npm y evitar referencias internas de entorno de generación.

## Objetivo

Evitar el error de Vercel durante `npm install`:

`npm error Exit handler never called!`

## Nota

No cambia la funcionalidad del CRM. Mantiene:

- Calendario visual de tareas.
- Drag & drop.
- Correo y WhatsApp responsable.
- Historial de alertas.
- Campo visual ampliado.
