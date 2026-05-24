# CRM Mecano V6.28 - Mejoras UX, Orígenes y Listas de Tareas

Cambios incluidos:

1. Botón de borrado local convertido en **Zona de riesgo** con doble confirmación y texto obligatorio `BORRAR DATOS`.
2. Dashboard principal más limpio: se eliminan los bloques largos de clientes para llamar hoy y presupuestos perdidos.
3. Origen del lead ahora es un menú desplegable administrable.
4. Se puede crear y borrar orígenes como IPPE, Interpack, Fenavi, LinkedIn, Referido, etc.
5. Filtros avanzados incluyen filtro por origen del lead.
6. Módulo Mis tareas y recordatorios organizado por listas/tópicos tipo Google Tasks.
7. Cada tarea puede tener lista, tipo, prioridad, fecha, hora y lead asociado.
8. El SQL de Supabase incluye la columna `task_list`.

Antes de producción, ejecutar `SUPABASE_TAREAS_RECORDATORIOS.sql` en Supabase.
