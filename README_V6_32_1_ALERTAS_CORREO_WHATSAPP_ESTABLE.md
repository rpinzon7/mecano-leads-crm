# CRM Mecano V6.32.1 — Alertas de correo y WhatsApp estable

Base: V6.32 producción / administrador global de tareas.

Corrección puntual:

- No se modifica el módulo base de tareas ni los vendedores.
- Los botones **Correo responsable** y **WhatsApp responsable** quedan visibles en toda tarea pendiente o abierta, no solo en tareas vencidas.
- Las tareas completadas o canceladas no muestran botones de alerta.
- WhatsApp abre explícitamente `web.whatsapp.com/send` con el mensaje prellenado.
- La apertura de WhatsApp se ejecuta antes de operaciones asíncronas de guardado para reducir bloqueos del navegador.
- Si el navegador bloquea la ventana, se muestra un enlace manual para copiar/abrir.
- Se conserva la trazabilidad en el historial de alertas.

No requiere SQL nuevo.
