# CRM Mecano V6.31 - Alertas de vencidos con correo, WhatsApp y trazabilidad

## Mejoras incluidas

- Panel destacado de alertas cuando existen tareas vencidas.
- Contador de tareas vencidas y vencidas críticas de prioridad Alta/Urgente.
- Botón **Ver vencidas** para filtrar rápidamente.
- En cada tarea vencida aparecen acciones:
  - **Enviar correo**: abre el cliente de correo con asunto y cuerpo prellenados.
  - **WhatsApp**: abre WhatsApp Web con mensaje prellenado.
- Trazabilidad registrada en la descripción de la tarea después de abrir el canal de alerta.
- Última trazabilidad visible dentro de la tarjeta de la tarea.

## Nota operativa

Esta es la versión segura: el CRM no envía correos ni WhatsApp automáticamente desde un servidor. Abre el canal con mensaje prellenado para que el usuario revise y envíe. La trazabilidad registra que se generó/abrió la alerta desde el CRM.

## Base de datos

No requiere cambios en Supabase ni SQL nuevo.
