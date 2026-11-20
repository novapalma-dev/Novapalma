# Suite de Pruebas Automatizadas y Cobertura (Coverage ≥ 60%) — Novapalma

Este documento detalla la arquitectura de pruebas automatizadas implementada sobre **Novapalma** (Node.js + Express + Prisma v7 + PostgreSQL + React/Vite), siguiendo la **Pirámide del Testing**, **Design for Testability**, el patrón **AAA (Arrange–Act–Assert)**, los principios **F.I.R.S.T.** y un **Quality Gate obligatorio ≥ 60%**.

---

## 1. Mapa de la Pirámide de Pruebas

| Nivel | Ubicación | Stack / Herramienta | Tests | Tiempo aprox. |
| :--- | :--- | :--- | :---: | :---: |
| **1A. Unitarias Backend (Puras + Schemas)** | `server/tests/unit/utils.test.js`, `schemas.test.js` | Vitest (`@vitest/coverage-v8`) | 32 | ~0.2 s |
| **1B. Unitarias Backend (Mocks Stub + Spy)** | `server/tests/unit/middlewares.test.js`, `services/*.test.js` | Vitest (`vi.mock`, `vi.fn`) | 32 | ~0.4 s |
| **1C. Unitarias Frontend (Utilidades Puras)** | `client/tests/unit/*.test.js` | Vitest (`@vitest/coverage-v8`) | 11 | ~0.2 s |
| **2A. Integración HTTP (API + Rutas + RBAC)** | `server/tests/integration/http-routes.test.js` | Vitest + Supertest | 10 | ~0.2 s |
| **2B. Integración Real PostgreSQL (ACID + Auditoría)** | `server/tests/integration/db.integration.test.js` | Vitest + Supertest + Prisma + PostgreSQL | 2 | ~1.0 s |
| **3. End-to-End (E2E en Navegador)** | `tests/test-quality.js`, `test-selenium-security.js`, `test-unsanitized-fields.js` | Selenium WebDriver + Chrome Headless | 3 suites | ~15 s |

---

## 2. Refactorización Aplicada (*Design for Testability*)

Antes de construir la suite, se desacoplaron reglas de negocio críticas que estaban embebidas en servicios, rutas Express y componentes React:

1. **Backend — `server/src/utils/tripCalculations.js`** (extraído de `trip.service.js`):
   * `calculateConductorPay(valorPago, porcentajeConductor)` (regla **BL-05**: acotado a `[0, 100]` y redondeo a 2 decimales).
   * `normalizeTripCosts(tripData)` (regla **BL-07**: anula `consumoAcpm`, `valorAcpm` y `valorFerry` cuando `usoAcpm`/`usoFerry` son `false`).
   * `parseUpdateFields(dataToUpdate)` y `buildTripsPaginationQuery(options)`.
2. **Backend — `server/src/utils/financeCalculations.js`** (extraído de `finance.routes.js`):
   * `buildFinanceDateFilter(startDate, endDate)` y `aggregateFinanceStats(trips)` (reglas **BL-07** y **BL-13**).
3. **Backend — `server/src/utils/dateRange.js`** (extraído de `dashboard.routes.js`):
   * `getMonthUtcRange(referenceDate)` (regla **BL-04**: límites de mes en `Date.UTC` sin desfase `UTC-5`).
4. **Backend — `server/src/app.js`**:
   * Bypass de `express-rate-limit` cuando `NODE_ENV === 'test'` para ejecutar pruebas HTTP con Supertest sin falsos `429`.
5. **Frontend — `client/src/utils/tripFormUtils.js` y `client/src/utils/financeUtils.js`** (extraídos de `Trips.jsx` y `Finance.jsx`):
   * `formatCurrencyCOP`, `calculateTripPayment`, `sanitizeTripInput`, `filterTripsByTicket`, `computeDisplayedFinanceStats` y `formatTripsForExcel`.

---

## 3. Instalación y Ejecución de Pruebas

### Instalar dependencias
```bash
npm --prefix server install
npm --prefix client install
```

### Comandos unificados desde la raíz (`./run-tests.sh`)
```bash
# Ejecutar todas las pruebas unitarias (Backend + Frontend)
./run-tests.sh unit

# Ejecutar pruebas de integración HTTP (Supertest)
./run-tests.sh integration

# Ejecutar pruebas de integración contra PostgreSQL real (requiere PostgreSQL activo)
./run-tests.sh integration:db

# Ejecutar suite completa con Code Coverage (Quality Gate >= 60%) y generar HTML
./run-tests.sh cov

# Ejecutar prueba E2E en navegador con Selenium (requiere backend y frontend levantados)
./run-tests.sh e2e
```

### Reportes visuales HTML de cobertura
Tras ejecutar `./run-tests.sh cov`, se generan automáticamente:
* **Backend:** `server/coverage/index.html`
* **Frontend:** `client/coverage/index.html`

---

## 4. Resumen de Cobertura Alcanzada (Quality Gate ≥ 60% SUPERADO)

### Backend (`server/src/**/*.js`)
| Capa / Módulo | % Statements | % Branches | % Functions | % Lines |
| :--- | :---: | :---: | :---: | :---: |
| **TOTAL BACKEND** | **84.51%** | **79.66%** | **87.25%** | **85.36%** |
| `src/utils/*` (`errorHandler`, `network`, `tripCalculations`, `financeCalculations`, `dateRange`) | **100%** | **91.78%** | **100%** | **100%** |
| `src/middlewares/*` (`auth`, `role`, `validate`) | **100%** | **88.46%** | **100%** | **100%** |
| `src/schemas/*` (6 esquemas Zod) | **96.15%** | **93.33%** | **88.88%** | **96.00%** |
| `src/services/*` (`trip`, `auth`, `user`, `vehicle`, `driver`, `audit`) | **91.78%** | **81.15%** | **100%** | **94.26%** |
| `src/routes/*` (9 routers Express) | **89.74%** | **58.33%** | **100%** | **89.74%** |

### Frontend (`client/src/utils/**/*.js`)
| Módulo | % Statements | % Branches | % Functions | % Lines |
| :--- | :---: | :---: | :---: | :---: |
| **TOTAL FRONTEND UTILS** | **98.07%** | **81.18%** | **100%** | **97.91%** |
| `financeUtils.js` | 100% | 75.80% | 100% | 100% |
| `tripFormUtils.js` | 96.29% | 89.74% | 100% | 96.00% |

---

## 5. Estrategia con IA y Auditoría contra *Tests Complacientes*

### Skill utilizada
Se creó la skill dedicada [`.agents/skills/novapalma-testing/SKILL.md`](.agents/skills/novapalma-testing/SKILL.md) que obliga al agente a:
* Seguir el patrón **AAA** y los principios **F.I.R.S.T.**.
* Derivar todas las aserciones de las reglas de negocio documentadas (`BL-01` a `BL-15`, `C1` a `C7`) y no del código actual.
* Usar Mocks con doble rol (**Stub** para aislar Prisma/`tx` y **Spy** para verificar `auditService.logAudit`).

### Prompts reales empleados
1. *Análisis y arquitectura:* `"Analiza los documentos de Semana 14 y Semana 15, compáralos con Novapalma usando el grafo graphify-out y propón el plan de refactorización Design for Testability y la suite de pruebas con coverage >= 60%."`
2. *Generación guiada por reglas de negocio:* `"Extrae las funciones puras de trip.service.js, finance.routes.js, dashboard.routes.js, Trips.jsx y Finance.jsx; genera pruebas unitarias AAA con valores límite (BL-04, BL-05, BL-07, BL-10, BL-11, BL-12, C1, C7), pruebas con Mocks Stub+Spy sobre TripService y pruebas de integración HTTP con Supertest y PostgreSQL real."`

### Caso real de corrección a la IA durante la construcción
Al generar `server/tests/unit/schemas.test.js`, la prueba de `profileSchema` envió `password: 'NuevaPassword123'` esperando `success: true`, pero **falló en rojo** porque la regla real de seguridad en `user.schema.js` exige al menos un carácter especial (`regex(/[^A-Za-z0-9]/)`). En lugar de debilitar el esquema o hacer un test complaciente, se corrigió el dato de prueba (`'NuevaPassword123!'`) manteniendo intacta la política de contraseñas robustas.

---

## 6. Guion para la Prueba de Fuego en Vivo (Sustentación)

1. Ejecutar `./run-tests.sh cov` → verificar **85 tests en VERDE** y cobertura **85.36% Backend / 97.91% Frontend** (≥ 60%).
2. Abrir `server/src/utils/tripCalculations.js` y alterar temporalmente la fórmula de comisión:
   ```js
   // Cambiar:
   const valorConductor = Math.round(valorPago * (pct / 100) * 100) / 100;
   // Por (defecto intencional):
   const valorConductor = Math.round(valorPago * (pct / 10) * 100) / 100;
   ```
3. Ejecutar `./run-tests.sh unit` → en **< 1 segundo** fallan en **ROJO** `utils.test.js` y `trip.service.test.js` mostrando valor esperado (`100000`) vs. obtenido (`1000000`).
4. Revertir el cambio y volver a ejecutar `./run-tests.sh unit` → suite nuevamente en **VERDE**.
