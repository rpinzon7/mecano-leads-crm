# CRM Mecano V6.32 — Administrador global de tareas

## Objetivo
Crear un rol `task_admin` para administrar tareas propias y tareas de todo el equipo comercial.

## Incluye
- Rol `task_admin` / `admin` desde Supabase.
- Tabla `crm_task_users` para registrar usuarios, correo, nombre, rol, estado y permiso de eliminación.
- Un administrador de tareas puede ver todas las tareas del CRM.
- Vista alterna: `Mis tareas` / `Todo el equipo`.
- Crear tareas para sí mismo o para otros usuarios.
- Editar tareas de cualquier usuario.
- Reasignar tareas.
- Cambiar fecha, estado, prioridad, tipo y lead asociado.
- Completar/cerrar tareas.
- Eliminar tareas si el usuario tiene rol `task_admin`, `admin` o `can_delete_tasks = true`.
- Filtro por responsable.
- Filtros existentes por estado, prioridad, tipo, fecha y lead asociado.

## Requiere SQL nuevo
Ejecutar en Supabase > SQL Editor:

- `SUPABASE_ADMIN_GLOBAL_TAREAS.sql`

Después de ejecutar el SQL, registrar en `crm_task_users` los usuarios reales de Supabase/Auth.

## Cómo activar un administrador de tareas
1. En Supabase, ir a Authentication > Users.
2. Copiar el `User UID` del usuario.
3. Ir a Table Editor > `crm_task_users`.
4. Crear o editar el registro del usuario.
5. Poner:
   - `user_id`: UID de Supabase/Auth
   - `email`: correo del usuario
   - `full_name`: nombre visible
   - `role`: `task_admin`
   - `active`: true
   - `can_delete_tasks`: true

## Validación
- Iniciar sesión con el usuario `task_admin`.
- Entrar a Tareas y recordatorios.
- Debe aparecer el bloque azul `Administrador global de tareas`.
- Cambiar de `Mis tareas` a `Todo el equipo`.
- Filtrar por responsable.
- Crear una tarea asignada a otro usuario.
- Editar/reasignar/cerrar/eliminar una tarea de otro usuario.
