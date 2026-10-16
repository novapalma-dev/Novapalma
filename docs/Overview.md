# Novapalma 🌴 · Visión General

* **Proyecto:** Plataforma de Gestión Logística y Financiera
* **Objetivo:** Optimización de cadena de suministro, control operativo de viajes, pesajes, fletes por tonelada, combustible (ACPM) y cruces de ferry.
* **Ubicación en disco:** `/home/asher/Novapalma`

---

## Stack Tecnológico

* **Backend:** Node.js v25 con Express
* **ORM & Base de Datos:** Prisma v7.8.0 (`@prisma/adapter-pg`) sobre PostgreSQL
* **Frontend:** React con Vite y TypeScript
* **Validación:** Zod para esquemas de entrada estrictos
* **Infraestructura:** Docker & Docker Compose
* **Pruebas:** Selenium WebDriver (E2E)

---

## Módulos Principales

1. **Gestión de Viajes:** Control de tickets, pesaje en báscula, origen/destino, servicios con transacciones ACID.
2. **Flota y Conductores:** Registro de camiones, conductores y estados operativos.
3. **Control de Tarifas:** Configuración administrativa de precios por tonelada (Normal / Especial).
4. **Reportes Financieros:** Consolidación de toneladas transportadas, consumo de ACPM, gastos de ferry y facturación global.
5. **Auditoría Forense:** Registro inmutable de cambios en `audit_logs` con snapshots *before/after*.

---

## Documentación y Grafo

* [[Novapalma/Bitacora|Bitácora de Desarrollo]]
* [[Novapalma/Grafo/graph.canvas|Lienzo de Arquitectura (Canvas)]]
* Repositorio local docs: `/home/asher/Novapalma/docs/`
