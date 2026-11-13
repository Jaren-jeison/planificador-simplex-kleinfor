# Planificador Simplex KLEINFOR

**Autoría:** Jaren Jeison Alfaro Porras · Investigación Operativa I · 2026-II

## Descripción breve

El Planificador Simplex KLEINFOR es una aplicación web que resuelve paso a paso, con el método Simplex y la metodología usada en clase, el modelo de programación lineal que el equipo planteó a partir del análisis de la empresa, y lo aplica a la planta de camisas de Industrias KLEINFOR E.I.R.L. Con los datos de los informes de Ingeniería de Procesos y de Ingeniería de Métodos, muestra cuántas camisas puede producir la planta, qué estación la frena y cómo repartir al personal para cumplir el pedido.

## Introducción al sistema

Industrias KLEINFOR E.I.R.L. es una empresa arequipeña que confecciona camisas y reporta una producción de referencia de unas 200 camisas por jornada. Sus informes de Ingeniería de Procesos y de Ingeniería de Métodos señalan tiempos improductivos, demoras entre operaciones y una distribución del trabajo que puede mejorar. El Planificador Simplex KLEINFOR toma esos datos y los convierte en modelos de programación lineal, que resuelve con el método Simplex en la variante Cj − Zj trabajada en clase.

El sistema tiene dos partes.

**1. Resolución del modelo con la metodología del curso.** Presenta el modelo *Producción por tallas (S, M y L)*, que el equipo planteó a partir del análisis de la planta para decidir cuántas camisas de cada talla producir por jornada:

> Max Z = x₁ + x₂ + x₃
> sujeto a 43.08x₁ + 43.08x₂ + 43.08x₃ ≤ 28 800 (tiempo en ojales y botones) y x₁ + x₂ + x₃ ≤ 200 (capacidad de planta)

Se recorre en tres pasos:
- **Planteamiento:** variables, forma canónica y forma estándar.
- **Tablas Simplex:** paso a paso, con la variable que entra (V.E.), la que sale (V.S.), la razón de cambio y las operaciones de Gauss-Jordan de cada fila.
- **Análisis de sensibilidad:** precios sombra, rangos de los recursos con B⁻¹, rangos de los coeficientes con Cj + d y comprobación con el dual.

**2. Aplicación en la planta.** Usa la documentación de la empresa: el DAP del método actual (36 actividades, 386.3 minutos por lote de 10 camisas) y el estudio de tiempos del botonado (43.08 s por camisa). Con esos tiempos arma un modelo por cada estación de trabajo y responde preguntas útiles para la gerencia:
- ¿Cuántas camisas puede hacer la planta con su personal actual y qué estación la frena? (modelo *Capacidad con el personal actual*)
- ¿Cómo repartir a los operarios entre las estaciones para producir lo máximo? (modelo *Mejor reparto del personal*)
- ¿Cuántas personas hacen falta para el pedido, y cuánto aporta un operario o una hora extra?
- ¿Qué pasa si cambian la jornada, el pedido, el personal o el método de botonado?

Cada dato muestra su fuente y se marca como **documentado**, **simulado** o **supuesto**. Así queda claro qué viene de los informes y qué debe validarse en planta. El personal de cada estación se ajusta directamente en el diagnóstico y los resultados se recalculan al instante.

## Qué aporta

- **Al curso:** el procedimiento completo del método Simplex y del análisis de sensibilidad, con el mismo formato visto en clase. El motor está verificado con ejercicios de resultado conocido.
- **A la empresa:** una herramienta para planificar la jornada con sus propios datos. Ubica el cuello de botella, propone un reparto del personal y cuantifica el efecto de cada cambio antes de hacerlo.

## Tecnología

Aplicación web estática hecha con HTML, CSS y JavaScript, sin servidor ni base de datos. Funciona en computadora y en celular. Los datos que se editan se guardan en el navegador y se pueden descargar en Excel, junto con las tablas Simplex y el análisis de sensibilidad, para revisarlos o corregirlos y volver a cargarlos.
