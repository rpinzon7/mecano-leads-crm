# CRM Mecano V6.31.2 — Responsables editables para alertas

Mejora sobre V6.31.1.

## Cambios incluidos

- Se agrega sección **Responsables de alertas** dentro del módulo de tareas.
- Permite agregar, editar, activar/desactivar y eliminar responsables.
- Cada responsable puede tener nombre, correo, WhatsApp y cargo/área.
- Los botones de tarea vencida **Correo responsable** y **WhatsApp responsable** usan la lista administrable.
- Si se modifica correo o WhatsApp al momento de enviar una alerta, el CRM intenta actualizar el responsable en Supabase.
- La trazabilidad de alertas sigue quedando registrada en la descripción de la tarea.

## Requisito Supabase

Ejecutar una sola vez el SQL:

- `SUPABASE_RESPONSABLES_ALERTAS.sql`
- o `supabase/sql/2026-06-21_crm_alert_recipients.sql`

Tabla creada:

- `crm_alert_recipients`

Si el SQL no se ejecuta, el CRM sigue mostrando responsables base locales, pero no podrá administrar la lista en nube.
