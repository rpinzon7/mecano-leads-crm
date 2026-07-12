# CRM Mecano V6.32.4 — Calendario editable con arrastrar y soltar

Base: V6.32.3 Calendario visual de tareas.

## Incluye

- Conserva administrador global de tareas.
- Conserva botones de correo y WhatsApp en tareas pendientes.
- Conserva trazabilidad e historial de alertas.
- Conserva campo visual ampliado y orden básico por prioridad operativa.
- Conserva vista Lista y Calendario.
- Agrega edición desde calendario con clic sobre la tarea.
- Agrega arrastrar y soltar tareas entre días para cambiar la fecha límite.
- Agrega zona `Tareas sin fecha` para quitar fecha arrastrando una tarea allí.
- Permite arrastrar tareas sin fecha hacia un día para programarlas.

## SQL

No requiere SQL nuevo.

## Validación

Probar:

1. Abrir Mis tareas y recordatorios.
2. Cambiar a vista Calendario.
3. Probar Día, Semana y Mes.
4. Hacer clic sobre una tarea y confirmar que abre edición.
5. Arrastrar una tarea a otro día y confirmar que cambia la fecha.
6. Arrastrar una tarea a Tareas sin fecha y confirmar que queda sin fecha.
7. Confirmar que Correo responsable y WhatsApp responsable siguen funcionando.
