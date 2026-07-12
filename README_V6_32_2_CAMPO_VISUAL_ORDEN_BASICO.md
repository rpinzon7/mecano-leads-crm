# CRM Mecano V6.32.2 — Campo visual ampliado y orden básico de trabajo

Base: V6.32.1 Alertas Correo WhatsApp Estable.

## Cambios

- Mantiene intacta la funcionalidad estable de alertas por correo y WhatsApp.
- Amplía el alto útil del listado de tareas.
- Reduce el espacio vertical de tarjetas para ver más tareas sin tanto scroll.
- Compacta descripción e historial de alertas.
- Ordena automáticamente las tareas por prioridad operativa:
  1. vencidas,
  2. hoy,
  3. próximas,
  4. sin fecha,
  5. completadas/canceladas al final,
  considerando también prioridad manual y fecha límite.
- Agrega etiqueta visual de prioridad operativa: Crítica, Alta, Media o Normal.

## SQL

No requiere SQL nuevo.

## Pruebas sugeridas

- Abrir Mis tareas y recordatorios.
- Confirmar que se ven más tareas en pantalla.
- Confirmar que Correo responsable y WhatsApp responsable siguen funcionando.
- Confirmar que Abrir lead, Editar, Completar y Eliminar siguen funcionando.
