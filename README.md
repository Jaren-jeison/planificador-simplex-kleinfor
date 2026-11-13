# Planificador Simplex KLEINFOR

Aplicación web para planificar la producción de camisas de **Industrias KLEINFOR E.I.R.L.** con el método Simplex. Usa los datos de los informes del equipo:

- **Toma de tiempos (Ingeniería de Métodos):** DAP de 36 actividades y tiempo estándar del botonado (43.0836 s por camisa).
- **Capítulo I (Ingeniería de Procesos):** jornada, producción de referencia, operarios documentados y disponibilidad de las máquinas.

Autoría: Jaren Jeison Alfaro Porras · Investigación Operativa I · 2026-II. La presentación del sistema está en [INTRODUCCION.md](INTRODUCCION.md).

## Cómo está organizado

**Resolución del modelo** con la metodología del curso (modelo *Producción por tallas (S, M y L)*, seleccionado por defecto). El modelo sale del análisis de la empresa que hizo el equipo; lo que se toma del curso es el procedimiento:

1. Planteamiento del modelo
2. Tablas Simplex paso a paso
3. Análisis de sensibilidad

**Aplicación en la planta** (con la documentación de la empresa):

| Pregunta de la empresa | Sección |
|---|---|
| ¿Cuánto produce la planta con su personal y qué estación la frena? | Diagnóstico de producción (modelo *Capacidad con el personal actual*) |
| ¿Cómo repartir a los operarios para producir lo máximo? | Diagnóstico · reparto sugerido (modelo *Mejor reparto del personal*) |
| ¿Cuántas personas hacen falta para el pedido? ¿Cuánto vale un operario o una hora extra? | Diagnóstico · Análisis de sensibilidad |
| ¿Qué pasa si cambian la jornada, el pedido, el personal o el método de botonado? | Simulador ¿qué pasa si? |
| ¿De dónde sale cada dato? | Datos de la empresa · Tiempo estándar del botonado |

Cada término técnico tiene un botón "?" con su explicación, y la Guía de uso reúne el glosario completo.

Las **tablas Simplex** siguen el formato del curso (variante Cj − Zj, M grande, V.E., V.S., razón de cambio y operaciones de Gauss-Jordan por fila). La **sensibilidad** usa Cj + d para los coeficientes, B⁻¹ × b' para los recursos y B⁻¹ × (b + 1) para los precios sombra, con comprobación por el dual.

## Estructura

```
planificador-simplex-kleinfor/
├── index.html          estructura y navegación
├── css/styles.css      diseño (tema claro y oscuro, adaptable a celular)
├── js/datos.js         datos de planta con su fuente y calidad (documentado, simulado, supuesto)
├── js/simplex.js       motor Simplex Cj − Zj con M grande y análisis de sensibilidad
├── js/modelos.js       construcción de los tres modelos e indicadores
├── js/excel.js         descarga y carga de datos en Excel (.xlsx)
├── js/app.js           pantallas e interacción
└── pruebas/prueba-motor.js   pruebas contra ejercicios con resultado conocido
```

No usa servidor ni base de datos: es un sitio estático. Lo que se edita en **Datos de la empresa** se guarda en el navegador (localStorage).

**Excel.** El botón **Descargar en Excel (.xlsx)** genera un libro con las hojas Resumen, Parámetros, Estaciones, Máquinas, Estudio de tiempos, DAP, las tablas Simplex y el análisis de sensibilidad en el formato del curso. Las hojas Parámetros, Estaciones, Máquinas y Estudio de tiempos se pueden corregir en Excel y volver a subir con **Cargar datos desde Excel**. La librería de Excel (SheetJS) se descarga de internet solo al usar estos botones.

## Abrir en la computadora

Haz doble clic en `index.html`. Para que las fuentes tipográficas carguen hace falta internet; sin conexión se usa una fuente del sistema.

## Probar el motor

Con Node.js instalado, desde esta carpeta:

```bash
node pruebas/prueba-motor.js
```

Verifica el modelo del equipo (Z = 200, rangos 8616 ≤ b1 < ∞ y 0 ≤ b2 ≤ 668.52), el problema 2 del Excel del curso, el ejemplo ATSA de minimización, las operaciones de fila del ejemplo FMA, casos no acotado e infactible, y los modelos de planta.

## Desplegar para la presentación

Es un sitio estático: no hay comando de compilación. La guía paso a paso para Netlify está en [DESPLIEGUE-NETLIFY.md](DESPLIEGUE-NETLIFY.md). También sirve en Vercel (*Framework Preset: Other*, sin comando de compilación) o en Render (*Static Site*, *Publish Directory* `.`).

## Datos supuestos

Los informes solo documentan 2 operarios en cuellos y 1 operaria en la botonadora. En las demás estaciones se cargó 1 operario como **supuesto** (marcado en rojo). Mientras no se ingrese el dato real, los operarios disponibles son la suma de los cargados. Al ingresar el personal real en **Datos de la empresa**, todo se recalcula.

La sección *Diferencias entre los documentos* de **Datos de la empresa** lista los datos que no coinciden entre el Word y el PDF y que conviene validar en planta.
