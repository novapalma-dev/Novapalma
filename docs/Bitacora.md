# Novapalma · Bitácora de Desarrollo

* **Estado del Proyecto:** Operativo con base PERN y Docker Compose
* **Última revisión:** Septiembre 2026

---

## Componentes y Arquitectura

* **Servidor (`/server`):**
  * Express con rutas modularizadas para viajes, vehículos, conductores y tarifas.
  * Modelado relacional en Prisma (`prisma/schema.prisma`).
* **Cliente (`/client`):**
  * Panel administrativo y vistas de operador en React + Vite.
* **Documentación Técnica Local:**
  * Diccionario de datos: `Novapalma/docs/DATA_DICTIONARY.md`
  * Métodos y clases: `Novapalma/docs/METODOS_Y_CLASES.md`
  * Guía de pruebas: `Novapalma/docs/TESTING_GUIDE.md`

---

## Sesiones Recientes

* **Octubre 2026 — Remediación y Hardening de Seguridad de Backend (C1–C7):**
  * **C1/C2:** Mitigación de Mass Assignment en middleware Zod (`req.body = schema.parse(...)`), esquemas con `.strict()` en viajes, vehículos, conductores, tarifas y usuarios. Separación del endpoint de autoservicio de perfil (`updateOwnProfile`) desacoplado de privilegios de administrador.
  * **C3:** Verificación estricta de token con `HS256`, consulta de usuario y rol fresco desde BD en cada petición autenticada, y revocación automática de sesiones ante cambios de rol, desactivación de cuenta o actualización de credenciales.
  * **C5/C6:** Hardening de `trust proxy` acotado por variables de entorno, extracción segura de IP contra spoofing, logout atómico con verificación estricta de firma y limpieza de cookies con directivas de seguridad completas.
  * **C4/C7:** Prevención de race conditions y lost updates mediante `FOR UPDATE` en transacciones ACID con raw queries en Prisma (`updateTrip`, `deleteTrip`, `updateUser`, `updateVehicle`, `updateDriver`), y serialización del quórum mínimo de administradores.

---

## Tareas y Próximos Pasos

- [x] Corrección de condiciones de carrera y mass assignment en backend.
- [ ] Revisión de migraciones Prisma y pools de conexión con `@prisma/adapter-pg`.
- [ ] Optimización de filtros en reportes financieros por rango de fechas y conductores.
- [ ] Mantenimiento de suites E2E con Selenium WebDriver.
