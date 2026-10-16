# Novapalma · Reglas del Agente y Memoria Persistente

## Memoria y Documentación Técnica
* La documentación destilada, arquitectura técnica y bitácora residen en el repositorio local:
  * Bitácora y estado actual: `docs/Bitacora.md` (o en la Bóveda de Obsidian en `~/Vault/Novapalma/Bitacora.md`)
  * Visión general y stack: `docs/Overview.md`
  * Diccionario de datos y modelos: `docs/DATA_DICTIONARY.md`
  * Métodos y clases: `docs/METODOS_Y_CLASES.md`
  * Guía de pruebas E2E: `docs/TESTING_GUIDE.md`
  * Grafo y lienzo visual de entidades: `~/Vault/Novapalma/Grafo/` (en Obsidian)

## Directrices de Eficiencia de Tokens
1. **Consulta primero la documentación:** Antes de inspeccionar archivos fuente o base de datos a ciegas, consulta `docs/Overview.md` o `docs/Bitacora.md` para entender el modelo de datos PERN y el estado actual. Esto ahorra hasta un 95% de tokens en cada sesión.
2. **Actualización de bitácora:** Al finalizar un cambio significativo o hito de desarrollo, actualiza la sección de sesiones recientes en `docs/Bitacora.md`.

## Estilo de Desarrollo
* Mantener la integridad transaccional ACID en viajes y pesajes.
* Validación estricta con esquemas Zod en entradas y DTOs.
* Prisma v7 con `@prisma/adapter-pg` para operaciones sobre PostgreSQL.
