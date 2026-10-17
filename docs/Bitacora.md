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
* **Octubre 2026 — Remediación de Lógica de Negocio (Sesión 1: BL-01 a BL-04):**
  * **BL-01:** Normalización estricta de `correo` (`.trim().toLowerCase()`) en esquemas Zod (`user.schema.js`) y capa de servicios (`user.service.js`, `auth.service.js`), y validación de `deletedAt: null` en `login`, evitando cuentas bloqueadas por mayúsculas.
  * **BL-02:** Restricción RBAC (`adminMiddleware`) en `PUT /api/viajes/:id` (`trip.routes.js`), alineando el backend con la política de solo administradores de `Trips.jsx`.
  * **BL-03:** Bloqueo de reactivación y sobrescritura implícita de vehículos/conductores inactivos en `POST /api/vehiculos` y `POST /api/conductores`, y restricción de `includeDeleted=true` exclusivamente al rol `ADMIN`.
  * **BL-04:** Corrección del rango mensual en `dashboard.routes.js` empleando `Date.UTC` para incluir los viajes registrados el día 1 de cada mes sin desfase por zona horaria (`UTC-5`).
* **Octubre 2026 — Remediación de Lógica de Negocio (Sesión 2: BL-05 a BL-08):**
  * **BL-05:** Límite máximo de `porcentajeConductor` acotado a `100%` en `trip.schema.js`, `trip.service.js` y `Trips.jsx`, con redondeo a 2 decimales en `calculateConductorPay`.
  * **BL-06:** Validación de vehículo y conductor activos (`activo: true` y `deletedAt: null`) al reasignar `vehicleId` o `driverId` durante `updateTrip`.
  * **BL-07:** Sincronización forzada en `createTrip`, `updateTrip` y `finance.routes.js` para anular `consumoAcpm`, `valorAcpm` y `valorFerry` cuando `usoAcpm` o `usoFerry` sean `false`.
  * **BL-08:** Sincronización del invariante `activo <-> deletedAt` en `updateVehicle` y `updateDriver`, habilitando la reactivación segura de registros dados de baja por el administrador.
* **Octubre 2026 — Remediación de Lógica de Negocio (Sesión 3: BL-09 a BL-12):**
  * **BL-09:** Centralización de tarifas y parámetros por defecto del sistema mediante el endpoint `/api/configuracion` (`settings.routes.js`, `rate-tariff.schema.js`) persistido y auditado en PostgreSQL, sincronizado automáticamente en `Settings.jsx` y `Trips.jsx`.
  * **BL-10:** Restricción de fechas futuras y límite físico de `tonelaje` (`<= 60` Ton) y `capacidad` (`<= 60` Ton) en `trip.schema.js`, `vehicle.schema.js` y `Trips.jsx`.
  * **BL-11:** Bloqueo de asignación de viajes a vehículos en estado `MANTENIMIENTO` en `validateActiveVehicle` (`trip.service.js`) y en `Trips.jsx`, e incorporación del selector de `estado` operativo en `Vehicles.jsx`.
  * **BL-12:** Verificación obligatoria de `currentPassword` al actualizar contraseña en `PUT /api/auth/perfil` (`auth.schema.js`, `user.service.js`, `Settings.jsx`), preservando activa la sesión actual mientras se revocan las demás sesiones.
* **Octubre 2026 — Remediación de Lógica de Negocio (Sesión 4: BL-13 a BL-15):**
  * **BL-13:** Validación estricta de formato/rango de fechas y redondeo aritmético a 2/3 decimales en `/api/finanzas/report` (`finance.routes.js`), corrección del cierre léxico en `handleReset` de `Finance.jsx`, y sincronización de `displayedStats` y `exportToExcel` con `filteredTrips` y flags `usoAcpm`/`usoFerry`.
  * **BL-14:** Unificación de validaciones de `cedula` (6 a 20 dígitos) y `telefono` (7 a 15 dígitos) entre `Drivers.jsx` y `driver.schema.js`.
  * **BL-15:** Propagación de metadatos forenses (`ipAddress` y `userAgent`) desde los controladores hacia todos los servicios CRUD (`trip`, `vehicle`, `driver`, `user`), snapshots simétricos de viajes en `audit_logs`, y limpieza automática de `refresh_tokens` expirados/revocados al iniciar sesión. Módulo de red (`network.js`) para resolver la IP pública real del cliente saltando los proxies internos de Render (`10.x.x.x`).
* **Octubre 2026 — Optimización de rendimiento (paginación):**
  * `GET /api/viajes` acepta `page`, `limit` (máx. 100) y `search` y devuelve `{ data, pagination }` con `count` + `findMany` en paralelo (`getTripsPaginated`); sin parámetros mantiene el comportamiento anterior (el Dashboard aún lo usa para sus gráficas).
  * `Trips.jsx`: paginación del lado del servidor con búsqueda *debounced* (350 ms) y selector de tamaño de página. `Vehicles.jsx` y `Drivers.jsx`: paginación en cliente (10 por página).

---

## Tareas y Próximos Pasos

- [x] Corrección de condiciones de carrera y mass assignment en backend.
- [x] Remediación integral de vulnerabilidades de lógica de negocio (BL-01 a BL-15).
- [ ] Revisión de migraciones Prisma y pools de conexión con `@prisma/adapter-pg`.
- [ ] Mantenimiento de suites E2E con Selenium WebDriver.
