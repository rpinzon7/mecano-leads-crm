# CRM Mecano V6.30 — Buscador y filtros avanzados en tareas

## Cambio principal
Se mejora el módulo **Mis tareas y recordatorios** con una capa de búsqueda y filtros avanzados sin modificar la estructura de Supabase.

## Incluye
- Buscador por título, descripción, tipo, estado, prioridad, lista, fecha, empresa, proyecto y datos básicos del lead asociado.
- Filtro por prioridad: Todas, Baja, Media, Alta, Urgente.
- Filtro por tipo de tarea.
- Filtro por tareas con lead asociado o sin lead asociado.
- Contador de tareas visibles frente al total cargado.
- Botón **Limpiar filtros**.
- Mensaje de resultados cuando hay filtros activos.

## Archivos modificados
- `src/components/TasksModule.jsx`
- `package.json`
- `package-lock.json`

## Base de datos
No requiere ejecutar SQL nuevo.

## Nota de seguridad
El archivo `.env` no se incluye en este paquete por seguridad. Para correr localmente, copiar el `.env` propio del proyecto o configurar las variables de entorno correspondientes.
