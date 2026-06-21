# CRM Mecano V6.31.3 — Trazabilidad limpia de alertas

Mejora visual sobre V6.31.2.

## Cambios

- La descripción principal de la tarea ya no muestra mezcladas las líneas de alerta CRM.
- Las alertas registradas se muestran en una caja separada llamada **Historial de alertas**.
- El historial muestra fecha, canal, responsable y usuario que registró la alerta.
- El correo/WhatsApp prellenado usa la descripción limpia, sin trazas anteriores.
- Al editar una tarea, el campo de descripción aparece limpio, pero las trazas existentes se conservan internamente al guardar.

## Base de datos

No requiere SQL nuevo si ya se ejecutó el SQL de V6.31.2 para `crm_alert_recipients`.
