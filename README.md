# Mecano Leads CRM v4 Cloud

Esta versión mantiene el CRM v3.3 y agrega **sincronización en nube con Supabase**.

## 1. Ejecutar local
```bash
npm install
npm run dev
```

## 2. Activar base de datos real
1. Crea un proyecto en Supabase.
2. En Supabase, abre **SQL Editor** y ejecuta:
   - `supabase/schema.sql`
3. Copia `.env.example` como `.env`
4. Llena:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CRM_WORKSPACE`

## 3. Cómo funciona la nube
- La app sigue guardando en el navegador.
- El botón **Sincronizar nube** guarda todos los leads en la tabla `crm_workspaces`.
- Al abrir la app en otro computador con la misma configuración `.env`, cargará el mismo workspace.

## 4. Publicar online
Puedes subir esta app a Vercel.

### Build
```bash
npm run build
```

### En Vercel
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Luego agrega en Vercel las mismas variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CRM_WORKSPACE`

## Nota importante
La política incluida permite acceso anónimo para acelerar la puesta en marcha.
Cuando ya la uses con tu equipo, conviene endurecer seguridad con autenticación.
