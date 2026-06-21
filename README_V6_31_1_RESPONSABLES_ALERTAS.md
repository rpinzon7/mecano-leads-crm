# CRM Mecano V6.31.1 — Alertas vencidas con responsables predeterminados

## Mejora principal

Se mejora la versión V6.31 agregando selector de responsables antes de enviar alertas por correo o WhatsApp.

## Incluye

- Lista inicial de responsables internos:
  - Ricardo Pinzón
  - Alejandra Carmona
  - Luz Dary Posada
  - Armando Pérez
  - Manuela Peña
- Opción Otro / manual.
- Botón de correo para tareas vencidas.
- Botón de WhatsApp para tareas vencidas.
- El correo o WhatsApp se pide la primera vez y queda guardado localmente en el navegador para ese responsable.
- Trazabilidad registrada en la descripción de la tarea.
- No requiere cambios en Supabase.

## Nota

Esta versión mantiene la estrategia segura: el CRM abre el cliente de correo o WhatsApp Web con el mensaje prellenado. El envío final lo hace el usuario.
