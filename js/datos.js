/* ==========================================================================
   Datos de planta de Industrias KLEINFOR E.I.R.L.
   Cada número indica de dónde sale. Calidad del dato:
     documentado → tomado tal cual de los informes del equipo
     simulado    → el propio informe aclara que los ciclos son simulados
     supuesto    → no figura en los informes; reemplazar con el dato real
   Fuentes:
     PDF  = "Estudio de métodos – Toma de tiempos" (Ingeniería de Métodos)
     WORD = "Capítulo I" (Ingeniería de Procesos)
   ========================================================================== */

const FUENTES = {
  pdfDap: 'PDF Toma de tiempos · DAP del método actual (págs. 18-19)',
  pdfTE: 'PDF Toma de tiempos · Tabla 16, tiempo estándar total',
  pdfTabla17: 'PDF Toma de tiempos · Tabla 17, tiempos por elemento',
  pdfMetodo: 'PDF Toma de tiempos · Tabla 23, método propuesto con guía física',
  pdfOperaria: 'PDF Toma de tiempos · 2.2.4, una operaria en la botonadora',
  pdfExterno: 'PDF Toma de tiempos · 3.1, el cuerpo se envía a sucursales externas',
  wordJornada: 'Word Capítulo I · 4.2, jornada de 8 a 10 horas',
  wordProduccion: 'Word Capítulo I · 3.1.1, producción referencial de 200 camisas por jornada',
  wordCuellos: 'Word Capítulo I · 4.2.1.1, dos operarios cosen los cuellos',
  wordFusion: 'Word Capítulo I · Formato 2, lotes de 100 unidades en 1 hora',
  wordDisp: 'Word Capítulo I · 5.1, disponibilidad de maquinaria 93.75 %',
  supuesto: 'Supuesto del modelo: reemplazar con el dato real de planta',
};

/* DAP del método actual: lote de 10 camisas, 36 actividades, 386.3 min, 123 m.
   tipo: op = operación, tr = transporte, es = espera, in = inspección, al = almacenamiento */
const DAP = [
  { n: 1, actividad: 'Tela en almacén', cantidad: '1 rollo', dist: 0, min: 0, tipo: 'al' },
  { n: 2, actividad: 'Llevar tela a mesa de corte', cantidad: '1 rollo', dist: 25, min: 4, tipo: 'tr' },
  { n: 3, actividad: 'Revisar tela', cantidad: '1 rollo', dist: 0, min: 6, tipo: 'in' },
  { n: 4, actividad: 'Tender tela', cantidad: '1 rollo', dist: 0, min: 8, tipo: 'op' },
  { n: 5, actividad: 'Trazar moldes', cantidad: '1 rollo', dist: 0, min: 5, tipo: 'op' },
  { n: 6, actividad: 'Cortar piezas', cantidad: '10 juegos', dist: 0, min: 15, tipo: 'op' },
  { n: 7, actividad: 'Revisar piezas cortadas', cantidad: '10 juegos', dist: 0, min: 5, tipo: 'in' },
  { n: 8, actividad: 'Espera de piezas para confección', cantidad: '10 juegos', dist: 0, min: 20, tipo: 'es' },
  { n: 9, actividad: 'Llevar piezas a confección', cantidad: '10 juegos', dist: 30, min: 5, tipo: 'tr' },
  { n: 10, actividad: 'Coser bolsillos', cantidad: '10 cuerpos', dist: 0, min: 10, tipo: 'op' },
  { n: 11, actividad: 'Hacer tapeta delantera', cantidad: '10 cuerpos', dist: 0, min: 15, tipo: 'op' },
  { n: 12, actividad: 'Unir hombros', cantidad: '10 cuerpos', dist: 0, min: 12, tipo: 'op' },
  { n: 13, actividad: 'Llevar piezas de cuello a su puesto', cantidad: '10 cuellos', dist: 8, min: 1, tipo: 'tr' },
  { n: 14, actividad: 'Fusionar entretela', cantidad: '10 cuellos', dist: 0, min: 8, tipo: 'op' },
  { n: 15, actividad: 'Armar cuello', cantidad: '10 cuellos', dist: 0, min: 20, tipo: 'op' },
  { n: 16, actividad: 'Pespuntear cuello', cantidad: '10 cuellos', dist: 0, min: 15, tipo: 'op' },
  { n: 17, actividad: 'Revisar cuello', cantidad: '10 cuellos', dist: 0, min: 4, tipo: 'in' },
  { n: 18, actividad: 'Unir cuello', cantidad: '10 camisas', dist: 0, min: 18, tipo: 'op' },
  { n: 19, actividad: 'Llevar piezas de mangas a su puesto', cantidad: '20 mangas', dist: 8, min: 1, tipo: 'tr' },
  { n: 20, actividad: 'Hacer tapetas de manga', cantidad: '20 mangas', dist: 0, min: 20, tipo: 'op' },
  { n: 21, actividad: 'Unir puños', cantidad: '20 puños', dist: 0, min: 15, tipo: 'op' },
  { n: 22, actividad: 'Revisar mangas', cantidad: '20 mangas', dist: 0, min: 4, tipo: 'in' },
  { n: 23, actividad: 'Coser mangas', cantidad: '10 camisas', dist: 0, min: 25, tipo: 'op' },
  { n: 24, actividad: 'Cerrar costados', cantidad: '10 camisas', dist: 0, min: 20, tipo: 'op' },
  { n: 25, actividad: 'Hacer dobladillo', cantidad: '10 camisas', dist: 0, min: 15, tipo: 'op' },
  { n: 26, actividad: 'Hacer ojales', cantidad: '10 camisas', dist: 0, min: 10, tipo: 'op' },
  { n: 27, actividad: 'Coser botones', cantidad: '10 camisas', dist: 0, min: 6.3, tipo: 'op' },
  { n: 28, actividad: 'Limpiar hilos', cantidad: '10 camisas', dist: 0, min: 10, tipo: 'op' },
  { n: 29, actividad: 'Espera para inspección final', cantidad: '10 camisas', dist: 0, min: 15, tipo: 'es' },
  { n: 30, actividad: 'Inspección final', cantidad: '10 camisas', dist: 0, min: 12, tipo: 'in' },
  { n: 31, actividad: 'Llevar camisas a planchado', cantidad: '10 camisas', dist: 12, min: 2, tipo: 'tr' },
  { n: 32, actividad: 'Planchar', cantidad: '10 camisas', dist: 0, min: 30, tipo: 'op' },
  { n: 33, actividad: 'Empacar', cantidad: '10 camisas', dist: 0, min: 15, tipo: 'op' },
  { n: 34, actividad: 'Espera de traslado a almacén', cantidad: '10 camisas', dist: 0, min: 10, tipo: 'es' },
  { n: 35, actividad: 'Llevar camisas a almacén', cantidad: '10 camisas', dist: 40, min: 5, tipo: 'tr' },
  { n: 36, actividad: 'Almacenar camisas terminadas', cantidad: '10 camisas', dist: 0, min: 0, tipo: 'al' },
];

const DATOS_ORIGINALES = {
  version: 1,
  empresa: 'Industrias KLEINFOR E.I.R.L.',
  loteDAP: 10, // camisas por lote en el DAP

  parametros: {
    jornadaHoras: { valor: 8, fuente: FUENTES.wordJornada, calidad: 'documentado' },
    pedido: { valor: 200, fuente: FUENTES.wordProduccion, calidad: 'documentado' },
    operariosDisponibles: { valor: 12, fuente: 'Supuesto: se calcula como la suma de los operarios cargados en el taller hasta que ingreses el dato real', calidad: 'supuesto' },
    disponibilidad: { valor: 93.75, fuente: FUENTES.wordDisp, calidad: 'documentado' },
  },

  /* Estaciones de trabajo: agrupan las operaciones e inspecciones del DAP.
     El tiempo por camisa se calcula desde los minutos del DAP (lote de 10). */
  estaciones: [
    { id: 'corte', nombre: 'Corte', actividades: [4, 5, 6], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'cuerpo', nombre: 'Confección de cuerpo', actividades: [10, 11, 12], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'cuellos', nombre: 'Cuellos', actividades: [14, 15, 16], operarios: 2, opFuente: FUENTES.wordCuellos, opCalidad: 'documentado', enTaller: true },
    { id: 'mangas', nombre: 'Mangas y puños', actividades: [20, 21], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'ensamble', nombre: 'Ensamble', actividades: [18, 23, 24, 25], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'ojales', nombre: 'Ojales', actividades: [26], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'botonado', nombre: 'Botonado', actividades: [27], operarios: 1, opFuente: FUENTES.pdfOperaria, opCalidad: 'documentado', enTaller: true, usaTE: true },
    { id: 'hilos', nombre: 'Limpieza de hilos', actividades: [28], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'inspeccion', nombre: 'Inspección y control', actividades: [3, 7, 17, 22, 30], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'planchado', nombre: 'Planchado', actividades: [32], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
    { id: 'empaque', nombre: 'Empaque', actividades: [33], operarios: 1, opFuente: FUENTES.supuesto, opCalidad: 'supuesto', enTaller: true },
  ],

  /* Máquinas únicas: su capacidad se reduce por la disponibilidad (mantenimiento y atascos). */
  maquinas: [
    { id: 'botonadora', nombre: 'Botonadora', cantidad: 1, segundos: null, vinculo: 'botonado', fuente: FUENTES.pdfTE + ' (ocupa la máquina todo el ciclo)', calidad: 'simulado' },
    { id: 'ojaladora', nombre: 'Ojaladora', cantidad: 1, segundos: 60, fuente: 'PDF Toma de tiempos · DAP actividad 26 (10 min por 10 camisas)', calidad: 'documentado' },
    { id: 'fusionadora', nombre: 'Fusionadora', cantidad: 1, segundos: 36, fuente: FUENTES.wordFusion + ' (1 unidad = 1 camisa, supuesto)', calidad: 'supuesto' },
  ],

  /* Estudio de tiempos de la colocación de botones (PDF, capítulo V).
     valoración = tiempo normal / tiempo observado de la Tabla 17. */
  estudioTiempos: {
    suplemento: 9, // % (5 % necesidades personales + 4 % fatiga básica)
    elementos: [
      { id: 'A', nombre: 'Agarrar la camisa', observado: 2.3131, valoracion: 102.8966, cadaN: 1 },
      { id: 'B', nombre: 'Colocar los botones (9 por camisa)', observado: 32.9819, valoracion: 101.6937, cadaN: 1 },
      { id: 'C', nombre: 'Retirar y dejar la camisa', observado: 2.1838, valoracion: 101.5111, cadaN: 1 },
      { id: 'F1', nombre: 'Reposición de camisas', observado: 14.62, valoracion: 95, cadaN: 10 },
    ],
    fuente: FUENTES.pdfTabla17,
    calidad: 'simulado',
  },

  presetsTiempos: {
    actual: { nombre: 'Método actual', A: 2.3131, B: 32.9819, C: 2.1838, fuente: FUENTES.pdfTabla17 },
    propuesto: { nombre: 'Método propuesto (guía física)', A: 2.30, B: 31.11, C: 2.20, fuente: FUENTES.pdfMetodo },
  },

  /* Modelo por tallas S, M y L (modelo principal del trabajo, metodología del curso). */
  curso: { redondearCoeficiente: true },

  dap: DAP,
};

/* Diferencias encontradas entre los documentos. El planificador las muestra en lugar de esconderlas. */
const ALERTAS_DATOS = [
  {
    nivel: 'warn',
    titulo: 'Botonado: dos tiempos distintos',
    texto: 'El Word registra ciclos de unos 18 s en ojales y botones (Formato 3). El PDF mide 37.48 s de ciclo y el DAP 37.8 s (6.3 min por 10 camisas). Se usa el estudio de tiempos del PDF.',
  },
  {
    nivel: 'warn',
    titulo: 'Cuellos: costura más rápida en el Word',
    texto: 'El Word registra 2.5 a 2.63 min por cuello. En el DAP, armar y pespuntear suman 3.5 min por cuello. Se usa el DAP porque cubre toda la estación.',
  },
  {
    nivel: 'warn',
    titulo: 'Fusionadora: dos ritmos',
    texto: 'El Word indica lotes de 100 unidades por hora (36 s por unidad). El DAP da 8 min por 10 cuellos (48 s). Falta confirmar si una "unidad" es un juego completo de cuello y puños.',
  },
  {
    nivel: 'info',
    titulo: 'El tiempo estándar viene de ciclos simulados',
    texto: 'El PDF aclara que sus 16 ciclos son simulados con fines académicos. El tiempo estándar de 43.08 s debe validarse con mediciones reales.',
  },
  {
    nivel: 'info',
    titulo: 'Operarios por estación sin documentar',
    texto: 'Los informes solo indican 2 operarios en cuellos y 1 operaria en la botonadora. El resto se cargó con 1 operario como supuesto.',
  },
  {
    nivel: 'info',
    titulo: 'Confección del cuerpo: ¿en taller o externa?',
    texto: 'El PDF menciona que el cuerpo se envía a sucursales externas, pero el DAP incluye esas operaciones en el taller. Si es externa, desmarca "En taller" en la estación.',
  },
  {
    nivel: 'info',
    titulo: '200 camisas es una referencia',
    texto: 'El Word aclara que las 200 camisas por jornada son una estimación de la empresa y no una capacidad técnicamente comprobada.',
  },
];

const ETIQUETAS_TIPO_DAP = {
  op: 'Operación', tr: 'Transporte', es: 'Espera', in: 'Inspección', al: 'Almacenamiento',
};
