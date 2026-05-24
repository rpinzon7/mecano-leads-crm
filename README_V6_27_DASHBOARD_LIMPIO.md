# CRM Mecano V6.27 - Dashboard limpio

Cambios principales:

- Se eliminó de la pantalla principal la lista larga de recordatorios.
- Se dejó un bloque compacto de seguimiento comercial con:
  - Recordatorios vencidos
  - Recordatorios de hoy
  - Recordatorios próximos 7 días
- Se agregó acceso directo desde el dashboard al módulo independiente **Mis tareas y recordatorios**.
- El módulo operativo de tareas se mantiene separado para no saturar la pantalla principal.
- Dentro del lead se conserva la opción de crear tareas específicas asociadas al cliente/lead.

Flujo recomendado:

1. Ejecutar `npm install`.
2. Ejecutar `npm run dev`.
3. Verificar que el dashboard se vea limpio.
4. Luego ejecutar el SQL de `SUPABASE_TAREAS_RECORDATORIOS.sql` en Supabase.
5. Probar crear tareas desde el módulo y desde un lead.
