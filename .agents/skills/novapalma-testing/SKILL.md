---
name: novapalma-testing
description: Guía y contrato de ingeniería para escribir, auditar y ejecutar pruebas automatizadas en Novapalma (Vitest, Supertest, Mocks Stub/Spy, Quality Gate >= 60%).
---

# Skill: Novapalma Testing & Quality Gate

## 1. Principios Obligatorios
1. **Patrón AAA (Arrange – Act – Assert):** Toda prueba debe separar claramente la preparación, la acción y las aserciones.
2. **Principios F.I.R.S.T.:** Rápidas (*Fast*), Independientes (*Independent*), Repetibles (*Repeatable*), Auto-validables (*Self-Validating*) y Oportunas (*Timely*).
3. **Prohibición de Tests Complacientes:** Las aserciones (`expect(...)`) deben derivarse de las **reglas de negocio humanas** (ver `docs/Bitacora.md`, reglas `BL-01` a `BL-15` y `C1` a `C7`), nunca copiando ciegamente un resultado erróneo del código actual.
4. **Mocks con doble propósito (Stub + Spy):**
   - **Stub:** Simular respuestas controladas de `prisma` / `tx` / `$queryRaw` para aislar la lógica de negocio.
   - **Spy:** Verificar con `expect(fn).toHaveBeenCalledWith(...)` que `auditService.logAudit` se invoca dentro de la misma transacción `tx` y que mutaciones bloqueadas **no** ejecutan escrituras ni auditoría.

## 2. Reglas de Negocio Críticas que Deben Tener Casos Borde (Boundary Values)
- **BL-01:** Normalización de correo (`.trim().toLowerCase()`).
- **BL-02:** RBAC estricto (`OPERADOR` recibe `403` en `PUT/DELETE /api/viajes/:id`, `/api/usuarios`, `/api/finanzas/report`).
- **BL-04:** Rango mensual del Dashboard calculado en `Date.UTC` (sin pérdida de viajes del día 1 por `UTC-5`).
- **BL-05:** `porcentajeConductor` acotado a `[0, 100]` con redondeo a 2 decimales (`Math.round(v * 100) / 100`).
- **BL-07:** Si `usoAcpm === false` o `usoFerry === false`, sus costos y consumos se anulan a `0`.
- **BL-10:** `tonelaje` y `capacidad` positivos y `<= 60` Ton; prohibidas fechas futuras.
- **BL-11:** Vehículos en estado `MANTENIMIENTO` no pueden asignarse a viajes.
- **BL-12:** Cambio de contraseña en `/api/auth/perfil` exige `currentPassword` y preserva solo la sesión actual.
- **C1/C2:** Esquemas `.strict()` rechazan campos no autorizados (*Mass Assignment*).
- **C4/C7:** Bloqueo `FOR UPDATE` (`tx.$queryRaw` retorna un arreglo `[locked]`) y quórum mínimo de 1 `ADMIN` activo.

## 3. Comandos de Verificación
```bash
./run-tests.sh unit            # Unitarias Backend + Frontend (< 2s)
./run-tests.sh integration     # Integración HTTP Supertest
./run-tests.sh integration:db  # Integración contra PostgreSQL real
./run-tests.sh cov             # Suite completa + Quality Gate >= 60% + HTML
```
