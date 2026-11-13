/* ==========================================================================
   Modelos de programación lineal construidos con los datos de planta
   1. Capacidad con el personal actual : ¿cuánto produce la planta con su personal y dónde se frena?
   2. Mejor reparto del personal       : ¿cómo repartir a los operarios para producir lo máximo?
   3. Producción por tallas           : S, M y L (modelo principal del trabajo)
   ========================================================================== */
(function (global) {
  'use strict';
  const S = global.Simplex || (typeof require !== 'undefined' ? require('./simplex.js') : null);
  const fmt = S.fmt;

  /* ---------- Tiempos y capacidades ---------- */
  function tiempoEstandarBotonado(estudio) {
    const sup = 1 + estudio.suplemento / 100;
    const detalle = estudio.elementos.map((e) => {
      const normal = e.observado * (e.valoracion / 100);
      const estandarEvento = normal * sup;
      return Object.assign({}, e, { normal, estandarEvento, porCamisa: estandarEvento / e.cadaN });
    });
    const total = detalle.reduce((a, e) => a + e.porCamisa, 0);
    return { detalle, total };
  }

  function minutosDAP(estado, actividades) {
    return actividades.reduce((acc, n) => {
      const fila = estado.dap.find((d) => d.n === n);
      return acc + (fila ? Number(fila.min) || 0 : 0);
    }, 0);
  }

  function segundosEstacion(estado, est) {
    if (est.usaTE) return tiempoEstandarBotonado(estado.estudioTiempos).total;
    return (minutosDAP(estado, est.actividades) * 60) / estado.loteDAP;
  }

  function segundosMaquina(estado, maq) {
    if (maq.vinculo) {
      const est = estado.estaciones.find((e) => e.id === maq.vinculo);
      return est ? segundosEstacion(estado, est) : 0;
    }
    return Number(maq.segundos) || 0;
  }

  const jornadaSeg = (estado) => estado.parametros.jornadaHoras.valor * 3600;

  /* Mientras el dato sea supuesto, los operarios disponibles = suma de los cargados en el taller */
  function operariosDisponibles(estado) {
    const p = estado.parametros.operariosDisponibles;
    if (p.calidad === 'supuesto') {
      return estado.estaciones.filter((e) => e.enTaller).reduce((a, e) => a + (Number(e.operarios) || 0), 0);
    }
    return Number(p.valor) || 0;
  }

  /* Capacidad (camisas por jornada) de cada estación y máquina */
  function capacidades(estado) {
    const T = jornadaSeg(estado);
    const pedido = estado.parametros.pedido.valor;
    const disp = estado.parametros.disponibilidad.valor / 100;
    const estaciones = estado.estaciones.map((est) => {
      const t = segundosEstacion(estado, est);
      const n = Number(est.operarios) || 0;
      const cap = est.enTaller ? (t > 0 ? (T * n) / t : Infinity) : Infinity;
      const requeridos = est.enTaller ? (pedido * t) / T : 0;
      return { est, t, n, cap, requeridos, minutos: minutosDAP(estado, est.actividades) };
    });
    const maquinas = estado.maquinas.map((maq) => {
      const t = segundosMaquina(estado, maq);
      const cap = t > 0 ? (T * disp * (Number(maq.cantidad) || 0)) / t : Infinity;
      return { maq, t, cap };
    });
    const internas = estaciones.filter((e) => e.est.enTaller);
    const sumaT = internas.reduce((a, e) => a + e.t, 0);
    const todas = internas.map((e) => ({ tipo: 'estacion', nombre: e.est.nombre, cap: e.cap }))
      .concat(maquinas.map((m) => ({ tipo: 'maquina', nombre: m.maq.nombre, cap: m.cap })));
    const limite = todas.reduce((a, x) => (x.cap < a.cap ? x : a), { cap: Infinity, nombre: '—' });
    const masLenta = internas.reduce((a, e) => (e.t > a.t ? e : a), internas[0] || { t: 0 });
    return {
      T, pedido, disp, estaciones, maquinas, internas, sumaT, limite, masLenta,
      requeridosTotal: (pedido * sumaT) / T,
      capacidadActual: limite.cap,
    };
  }

  /* ---------- Constructores de modelos ---------- */
  function modeloActual(estado) {
    const c = capacidades(estado);
    const restricciones = [];
    c.internas.forEach((e) => {
      restricciones.push({
        nombre: e.est.nombre, coef: [round6(e.t)], tipo: '<=', rhs: round6(c.T * e.n),
        unidad: 's-operario', detalle: `${fmt(e.t, { decimales: 2 })} s por camisa · ${fmt(e.n)} operario(s) × ${fmt(c.T)} s`,
        clase: 'estacion', ref: e.est.id,
      });
    });
    c.maquinas.forEach((m) => {
      restricciones.push({
        nombre: 'Máquina: ' + m.maq.nombre, coef: [round6(m.t)], tipo: '<=', rhs: round6(c.T * c.disp * m.maq.cantidad),
        unidad: 's-máquina', detalle: `${fmt(m.t, { decimales: 2 })} s por camisa · ${fmt(m.maq.cantidad)} máquina(s) × ${fmt(c.T)} s × ${fmt(c.disp * 100, { decimales: 2 })} % disponible`,
        clase: 'maquina', ref: m.maq.id,
      });
    });
    return {
      id: 'actual',
      nombre: 'Capacidad con el personal actual',
      pregunta: '¿Cuánto puede producir la planta con su personal actual y qué estación la frena?',
      sentido: 'max',
      variables: [{ nombre: 'P', etiqueta: 'Camisas producidas por jornada', unidad: 'camisas' }],
      objetivo: [1],
      restricciones,
      lectura: 'Cada restricción dice que el tiempo que exige la producción (segundos por camisa × camisas) no puede superar el tiempo disponible de la estación (operarios × jornada).',
    };
  }

  function modeloOptimo(estado) {
    const c = capacidades(estado);
    const k = c.internas.length;
    const variables = [{ nombre: 'P', etiqueta: 'Camisas producidas por jornada', unidad: 'camisas' }]
      .concat(c.internas.map((e, i) => ({ nombre: 'n' + (i + 1), etiqueta: 'Operarios en ' + e.est.nombre, unidad: 'operarios', ref: e.est.id })));
    const objetivo = [1].concat(new Array(k).fill(0));
    const restricciones = c.internas.map((e, i) => {
      const coef = new Array(k + 1).fill(0);
      coef[0] = round6(e.t); coef[i + 1] = -c.T;
      return { nombre: e.est.nombre, coef, tipo: '<=', rhs: 0, unidad: 's', detalle: `${fmt(e.t, { decimales: 2 })}·P ≤ ${fmt(c.T)}·n${i + 1}`, clase: 'estacion', ref: e.est.id };
    });
    restricciones.push({
      nombre: 'Operarios disponibles', coef: [0].concat(new Array(k).fill(1)), tipo: '<=', rhs: operariosDisponibles(estado),
      unidad: 'operarios', detalle: 'Suma de operarios asignados', clase: 'personal',
    });
    c.maquinas.forEach((m) => {
      const coef = new Array(k + 1).fill(0); coef[0] = round6(m.t);
      restricciones.push({
        nombre: 'Máquina: ' + m.maq.nombre, coef, tipo: '<=', rhs: round6(c.T * c.disp * m.maq.cantidad),
        unidad: 's-máquina', detalle: `${fmt(m.t, { decimales: 2 })}·P ≤ ${fmt(c.T * c.disp * m.maq.cantidad, { decimales: 2 })}`, clase: 'maquina', ref: m.maq.id,
      });
    });
    restricciones.push({
      nombre: 'Pedido', coef: [1].concat(new Array(k).fill(0)), tipo: '<=', rhs: c.pedido,
      unidad: 'camisas', detalle: 'No producir más de lo pedido', clase: 'pedido',
    });
    return {
      id: 'optimo',
      nombre: 'Mejor reparto del personal',
      pregunta: '¿Cómo repartir a los operarios disponibles entre las estaciones para producir lo máximo?',
      sentido: 'max',
      variables, objetivo, restricciones,
      lectura: 'El Simplex decide la producción P y cuántos operarios poner en cada estación (n1…nk). Cada estación debe tener tiempo suficiente para P camisas, sin pasar del total de operarios ni del pedido.',
    };
  }

  function modeloCurso(estado) {
    const T = jornadaSeg(estado);
    let t = tiempoEstandarBotonado(estado.estudioTiempos).total;
    if (estado.curso.redondearCoeficiente) t = Math.round(t * 100) / 100;
    const pedido = estado.parametros.pedido.valor;
    return {
      id: 'curso',
      nombre: 'Producción por tallas (S, M y L)',
      pregunta: '¿Cuántas camisas de cada talla producir por jornada para maximizar el volumen?',
      sentido: 'max',
      variables: [
        { nombre: 'x1', etiqueta: 'Camisas talla S', unidad: 'camisas' },
        { nombre: 'x2', etiqueta: 'Camisas talla M', unidad: 'camisas' },
        { nombre: 'x3', etiqueta: 'Camisas talla L', unidad: 'camisas' },
      ],
      objetivo: [1, 1, 1],
      restricciones: [
        { nombre: 'Tiempo en ojales y botones', coef: [t, t, t], tipo: '<=', rhs: T, unidad: 's', detalle: `${fmt(t)} s por camisa · jornada de ${fmt(T)} s`, clase: 'estacion', ref: 'botonado', holgura: 'segundos de la jornada que sobran en ojales y botones' },
        { nombre: 'Capacidad de planta', coef: [1, 1, 1], tipo: '<=', rhs: pedido, unidad: 'camisas', detalle: 'Meta referencial de producción diaria', clase: 'pedido', holgura: `camisas que faltan para llegar a ${fmt(pedido)}` },
      ],
      lectura: 'Es el modelo de la presentación: Max Z = x1 + x2 + x3 con la restricción de tiempo del botonado y la cota de 200 camisas.',
    };
  }

  const CONSTRUCTORES = { actual: modeloActual, optimo: modeloOptimo, curso: modeloCurso };

  function resolverModelo(id, estado) {
    const lp = CONSTRUCTORES[id](estado);
    const res = S.resolver(lp);
    return { lp, res };
  }

  /* ---------- Plan práctico de personal (operarios polivalentes) ---------- */
  function planPersonal(nombres, cantidades) {
    const filas = nombres.map((nombre, i) => {
      const q = Math.max(0, cantidades[i]);
      const fijos = Math.floor(q + 1e-6);
      return { nombre, q, fijos, resto: Math.max(0, q - fijos) };
    });
    /* Las fracciones se reparten entre operarios polivalentes: cada uno completa hasta
       una jornada y, si una estación no cabe entera, su trabajo se divide entre dos personas. */
    const restos = filas.filter((f) => f.resto > 0.01).sort((a, b) => b.resto - a.resto);
    const polivalentes = [];
    let actual = null;
    restos.forEach((f) => {
      let pendiente = f.resto;
      while (pendiente > 0.005) {
        if (!actual || actual.carga >= 0.995) { actual = { carga: 0, partes: [] }; polivalentes.push(actual); }
        const toma = Math.min(pendiente, 1 - actual.carga);
        actual.carga += toma;
        actual.partes.push({ nombre: f.nombre, fraccion: toma });
        pendiente -= toma;
      }
    });
    const totalPersonas = filas.reduce((a, f) => a + f.fijos, 0) + polivalentes.length;
    return { filas, polivalentes, totalPersonas };
  }

  /* ---------- Indicadores para el tablero y los escenarios ---------- */
  function indicadores(estado) {
    const c = capacidades(estado);
    const actual = resolverModelo('actual', estado);
    const optimo = resolverModelo('optimo', estado);
    const N = operariosDisponibles(estado);

    let precioOperario = 0, precioPedido = 0;
    let horaExtra = null;
    if (optimo.res.sensibilidad) {
      optimo.lp.restricciones.forEach((r, i) => {
        if (r.clase === 'personal') precioOperario = optimo.res.sensibilidad.precios[i].y;
        if (r.clase === 'pedido') precioPedido = optimo.res.sensibilidad.precios[i].y;
      });
    }
    if (actual.res.sensibilidad) {
      const s = actual.res.sensibilidad;
      let mejor = null;
      actual.lp.restricciones.forEach((r, i) => {
        const y = s.precios[i].y;
        if (y > 1e-9 && (!mejor || y > mejor.y)) mejor = { i, y, r, rango: s.rangosB[i] };
      });
      if (mejor) {
        const extraHoras = isFinite(mejor.rango.max) ? (mejor.rango.max - mejor.r.rhs) / 3600 : Infinity;
        horaExtra = { nombre: mejor.r.nombre, camisasPorHora: mejor.y * 3600, hastaHoras: extraHoras, clase: mejor.r.clase };
      }
    }

    const nOpt = optimo.lp.variables.slice(1).map((_, k) => optimo.res.valores[k + 1] || 0);
    const plan = planPersonal(c.internas.map((e) => e.est.nombre), nOpt);
    const requeridosPlan = planPersonal(c.internas.map((e) => e.est.nombre), c.internas.map((e) => e.requeridos));
    const jornadaNecesaria = N > 0 ? (c.pedido * c.sumaT) / (N * 3600) : Infinity;

    const dapTotal = estado.dap.reduce((a, d) => a + (Number(d.min) || 0), 0);
    const dapImprod = estado.dap.filter((d) => d.tipo === 'tr' || d.tipo === 'es').reduce((a, d) => a + (Number(d.min) || 0), 0);
    const dapDist = estado.dap.reduce((a, d) => a + (Number(d.dist) || 0), 0);
    const operariosCargados = estado.estaciones.filter((e) => e.enTaller).reduce((a, e) => a + (Number(e.operarios) || 0), 0);

    return {
      c, actual, optimo, N,
      capacidadActual: actual.res.estado === 'optimo' ? actual.res.z : 0,
      produccionOptima: optimo.res.estado === 'optimo' ? optimo.res.z : 0,
      precioOperario, precioPedido, horaExtra, plan, requeridosPlan, jornadaNecesaria,
      dapTotal, dapImprod, dapDist, operariosCargados,
    };
  }

  function round6(x) { return Math.round(x * 1e6) / 1e6; }

  const Modelos = {
    tiempoEstandarBotonado, segundosEstacion, segundosMaquina, capacidades, jornadaSeg, operariosDisponibles,
    construir: (id, estado) => CONSTRUCTORES[id](estado), resolverModelo, planPersonal, indicadores,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Modelos;
  else global.Modelos = Modelos;
})(typeof window !== 'undefined' ? window : globalThis);
