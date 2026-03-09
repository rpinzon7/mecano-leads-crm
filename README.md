# Mecano Leads CRM v5 Auth

Esta versión agrega login real con Supabase Auth sobre la versión cloud.

## Ejecutar
```bash
npm install
npm run dev
```

## Variables
Copia `.env.example` a `.env` y completa:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CRM_WORKSPACE`

## Configurar login en Supabase
1. Ve a `Authentication -> Sign In / Providers` y activa **Email**.
2. En `Authentication -> URL Configuration`, agrega tu URL local y de Vercel como Site URL / Redirect URLs.
3. Para pruebas, puedes desactivar confirmación obligatoria por email.

## Deploy
Sube a GitHub y Vercel como en la versión cloud.
Después de cambiar variables, haz **Redeploy** sin cache.


## V6.2
- pipeline comercial actualizado
- dashboard comercial
- login de usuarios
- sincronización en nube
- panel lateral de edición


## V6.3
- kanban con desplazamiento horizontal
- columnas al mismo nivel
- scroll vertical interno por columna
