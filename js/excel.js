/* ==========================================================================
   Descarga y carga de datos en Excel (.xlsx)
   Usa SheetJS, que se carga desde cdnjs solo cuando se pide un Excel.
   El libro trae:
     - Hojas editables: Parámetros, Estaciones, Máquinas y Estudio de tiempos.
       Se pueden corregir en Excel y volver a cargar en el planificador.
     - Hojas de consulta: Resumen, DAP, tablas Simplex y sensibilidad
       con el formato del curso (Cj − Zj, V.E., V.S., R/C).
   Autoría: Jaren Jeison Alfaro Porras
   ========================================================================== */
(function (global) {
  'use strict';
  const URL_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const S = global.Simplex;
  const M = global.Modelos;

  let cargando = null;
  function cargarLibreria() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (cargando) return cargando;
    cargando = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = URL_XLSX;
      s.async = true;
      s.onload = () => (global.XLSX ? ok(global.XLSX) : mal(new Error('sin XLSX')));
      s.onerror = () => { cargando = null; s.remove(); mal(new Error('No se pudo cargar la librería de Excel')); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  /* ---------- utilidades ---------- */
  const r6 = (x) => (typeof x === 'number' && isFinite(x) ? Math.round(x * 1e6) / 1e6 : x);
  const num = (x) => (x === Infinity ? '∞' : x === -Infinity ? '−∞' : r6(S.limpiar(x)));
  const mv = (a) => (Math.abs(a[1]) < 1e-9 ? r6(S.limpiar(a[0])) : S.fmtM(a, { decimales: 4 }));
  const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const SIM = { '<=': '≤', '>=': '≥', '=': '=' };
  const NOMBRE_MODELO = { curso: 'tallas', actual: 'personal actual', optimo: 'mejor reparto' };

  const PARAMS = [
    ['jornadaHoras', 'Jornada de trabajo', 'horas'],
    ['pedido', 'Pedido de referencia', 'camisas por jornada'],
    ['operariosDisponibles', 'Operarios disponibles', 'personas'],
    ['disponibilidad', 'Disponibilidad de las máquinas', '%'],
  ];
  const CALIDAD = { documentado: 'Documentado', simulado: 'Simulado', supuesto: 'Supuesto', ingresado: 'Ingresado' };
  const TIPO_DAP = { op: 'Operación', tr: 'Transporte', es: 'Espera', in: 'Inspección', al: 'Almacenamiento' };

  function hoja(XLSX, filas, anchos) {
    const ws = XLSX.utils.aoa_to_sheet(filas);
    if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }));
    return ws;
  }

  function textoObjetivo(lp) {
    const t = lp.variables.map((v, k) => {
      const c = lp.objetivo[k];
      if (Math.abs(c) < 1e-12) return null;
      return (Math.abs(c - 1) < 1e-12 ? '' : S.fmt(c) + ' ') + v.nombre;
    }).filter(Boolean).join(' + ');
    return `${lp.sentido === 'max' ? 'Max' : 'Min'} Z = ${t}`;
  }
  function textoRestriccion(lp, r) {
    const t = r.coef.map((c, k) => (Math.abs(c) < 1e-12 ? null : `${Math.abs(c - 1) < 1e-12 ? '' : S.fmt(c)}${lp.variables[k].nombre}`)).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
    return `${t} ${SIM[r.tipo]} ${S.fmt(r.rhs)}`;
  }

  /* ---------- hojas ---------- */
  function hojaResumen(XLSX, estado, modelos) {
    const ind = M.indicadores(estado);
    const filas = [
      ['Planificador Simplex KLEINFOR'],
      ['Industrias KLEINFOR E.I.R.L. · Investigación Operativa I · 2026-II'],
      ['Autoría: Jaren Jeison Alfaro Porras'],
      ['Generado el', new Date().toLocaleString('es-PE')],
      [],
      ['Resultados'],
    ];
    modelos.forEach(({ lp, res }) => {
      filas.push([lp.nombre, res.estado === 'optimo' ? `Z = ${S.fmt(res.z)}` : 'Sin solución óptima', textoObjetivo(lp)]);
    });
    filas.push(['Capacidad de la planta con el personal cargado', r6(ind.capacidadActual), 'camisas por jornada']);
    filas.push(['Estación que frena la producción', ind.c.limite ? ind.c.limite.nombre : '—']);
    filas.push([]);
    filas.push(['Cómo usar este archivo']);
    filas.push(['Las hojas Parámetros, Estaciones, Máquinas y Estudio de tiempos se pueden editar.']);
    filas.push(['Cambia solo las columnas de valores (no las columnas Clave o Id) y carga el archivo con "Cargar datos desde Excel".']);
    filas.push(['Las hojas de tablas Simplex y sensibilidad son de consulta: el planificador las vuelve a calcular.']);
    return hoja(XLSX, filas, [48, 26, 40]);
  }

  function hojaParametros(XLSX, estado) {
    const filas = [['Clave', 'Parámetro', 'Valor', 'Unidad', 'Calidad del dato', 'Fuente']];
    PARAMS.forEach(([clave, nombre, unidad]) => {
      const p = estado.parametros[clave];
      const valor = clave === 'operariosDisponibles' ? M.operariosDisponibles(estado) : p.valor;
      filas.push([clave, nombre, r6(valor), unidad, CALIDAD[p.calidad] || p.calidad, p.fuente]);
    });
    return hoja(XLSX, filas, [22, 30, 10, 20, 16, 70]);
  }

  function hojaEstaciones(XLSX, estado) {
    const filas = [['Id', 'Estación', 'Operarios', 'En taller (Sí/No)', 'Actividades del DAP', 'Segundos por camisa', 'Calidad del dato', 'Fuente']];
    estado.estaciones.forEach((s) => {
      filas.push([s.id, s.nombre, r6(Number(s.operarios) || 0), s.enTaller ? 'Sí' : 'No', s.actividades.join(', '), r6(M.segundosEstacion(estado, s)), CALIDAD[s.opCalidad] || s.opCalidad, s.opFuente]);
    });
    return hoja(XLSX, filas, [12, 24, 10, 16, 20, 18, 16, 60]);
  }

  function hojaMaquinas(XLSX, estado) {
    const filas = [['Id', 'Máquina', 'Cantidad', 'Segundos por camisa', 'Calidad del dato', 'Fuente']];
    estado.maquinas.forEach((q) => {
      filas.push([q.id, q.nombre, r6(Number(q.cantidad) || 0), q.vinculo ? `= estación ${q.vinculo} (${S.fmt(M.segundosMaquina(estado, q))})` : r6(Number(q.segundos) || 0), CALIDAD[q.calidad] || q.calidad, q.fuente]);
    });
    return hoja(XLSX, filas, [14, 16, 10, 26, 16, 60]);
  }

  function hojaEstudio(XLSX, estado) {
    const et = estado.estudioTiempos;
    const te = M.tiempoEstandarBotonado(et);
    const filas = [['Id', 'Elemento', 'Tiempo observado (s)', 'Valoración (%)', 'Cada N camisas', 'Tiempo estándar por camisa (s)']];
    et.elementos.forEach((el, i) => {
      const d = te.detalle && te.detalle[i];
      filas.push([el.id, el.nombre, r6(el.observado), r6(el.valoracion), r6(el.cadaN), d ? r6(d.porCamisa) : '']);
    });
    filas.push(['SUPLEMENTO', 'Suplementos (%)', r6(et.suplemento)]);
    filas.push([]);
    filas.push(['', 'Tiempo estándar total del botonado (s por camisa)', '', '', '', r6(te.total)]);
    filas.push(['', 'Fuente: ' + et.fuente]);
    return hoja(XLSX, filas, [12, 44, 20, 16, 16, 28]);
  }

  function hojaDAP(XLSX, estado) {
    const filas = [['N°', 'Actividad', 'Cantidad', 'Distancia (m)', 'Tiempo (min)', 'Tipo']];
    estado.dap.forEach((d) => filas.push([d.n, d.actividad, d.cantidad, d.dist, d.min, TIPO_DAP[d.tipo] || d.tipo]));
    const tot = estado.dap.reduce((a, d) => [a[0] + (Number(d.dist) || 0), a[1] + (Number(d.min) || 0)], [0, 0]);
    filas.push(['', 'Total (lote de ' + estado.loteDAP + ' camisas)', '', r6(tot[0]), r6(tot[1]), '']);
    return hoja(XLSX, filas, [6, 40, 14, 14, 14, 16]);
  }

  function hojaSimplex(XLSX, lp, res) {
    const cols = res.cols;
    const filas = [[`Tablas Simplex · ${lp.nombre}`], [textoObjetivo(lp)]];
    lp.restricciones.forEach((r) => filas.push(['', `${r.nombre}: ${textoRestriccion(lp, r)}`]));
    filas.push(['', 'Método Cj − Zj · V.E. = variable que entra · V.S. = variable que sale · R/C = razón de cambio']);
    filas.push([]);
    const total = res.iteraciones.length;
    res.iteraciones.forEach((t, idx) => {
      const ultima = idx === total - 1;
      filas.push([idx === 0 ? 'Tabla inicial' : (ultima && res.estado === 'optimo' ? `Tabla ${idx + 1} · solución óptima` : `Tabla ${idx + 1}`)]);
      filas.push(['Operación', 'Base', 'CB'].concat(cols.map((c) => c.nombre), ['bj', 'R/C', '']));
      filas.push(['', '', 'Cj →'].concat(cols.map((c) => mv(c.costo)), ['', '', '']));
      t.A.forEach((fila, r) => {
        const op = t.ops ? t.ops[r].texto : t.etiquetas[r];
        const rc = t.razones ? (t.razones[r] === null ? '—' : num(t.razones[r])) : '';
        filas.push([op, cols[t.base[r]].nombre, mv(t.CB[r])].concat(fila.map(num), [num(t.b[r]), rc, r === t.sale ? 'V.S.' : '']));
      });
      filas.push(['', 'Zj', ''].concat(t.Zj.map(mv), [mv(t.Zb), '', '']));
      filas.push(['', 'Cj − Zj', ''].concat(t.delta.map(mv), ['', '', '']));
      if (t.entra !== null) {
        filas.push(['', '', ''].concat(cols.map((_, j) => (j === t.entra ? 'V.E.' : '')), ['', '', '']));
        filas.push(['', t.sale !== null
          ? `Entra ${cols[t.entra].nombre}, sale ${cols[t.base[t.sale]].nombre}. Pivote = ${S.fmt(t.pivote)}.`
          : `Entra ${cols[t.entra].nombre}; ninguna razón es positiva: problema no acotado.`]);
      } else if (res.estado === 'optimo') {
        filas.push(['', `Solución óptima: ${t.base.map((j, r) => `${cols[j].nombre} = ${S.fmt(t.b[r])}`).join(', ')}; Z = ${S.fmtM(t.Zb)}`]);
      }
      filas.push([]);
    });
    return hoja(XLSX, filas, [30, 10, 8].concat(cols.map(() => 11), [12, 10, 6]));
  }

  function hojaSensibilidad(XLSX, lp, res) {
    const s = res.sensibilidad;
    const cols = res.cols;
    const filas = [[`Análisis de sensibilidad · ${lp.nombre}`], [`Solución óptima: Z = ${S.fmt(res.z)}`], []];
    filas.push(['a) Precio sombra · se comprueba con B⁻¹ × (b + 1) y Z\' − Z']);
    filas.push(['Restricción', 'bj', 'Holgura', 'Precio sombra', 'Comprobación Z\' − Z', 'Lectura']);
    lp.restricciones.forEach((r, i) => {
      const p = s.precios[i];
      filas.push([r.nombre, num(r.rhs), num(p.holgura), num(p.y), p.factible ? num(p.zNuevo - res.z) : 'fuera de rango', p.y > 1e-9 ? 'Limita la solución' : 'Sobra: una unidad más no cambia Z']);
    });
    filas.push([]);
    filas.push(['b) Rango de los recursos (bj) · B⁻¹ × b\' ≥ 0']);
    filas.push(['Restricción', 'bj actual', 'Mínimo', 'Máximo', 'd mínimo', 'd máximo']);
    lp.restricciones.forEach((r, i) => {
      const x = s.rangosB[i];
      filas.push([r.nombre, num(r.rhs), num(x.min), num(x.max), num(x.dmin), num(x.dmax)]);
    });
    filas.push([]);
    filas.push(['Matriz B⁻¹ (columnas de las holguras iniciales en la tabla óptima)']);
    filas.push(['Base'].concat(res.colInicial.map((c) => cols[c].nombre), ['bj']));
    s.Binv.forEach((fila, k) => filas.push([cols[res.final.base[k]].nombre].concat(fila.map(num), [num(res.final.b[k])])));
    filas.push([]);
    filas.push([`c) Rango de los coeficientes (Cj) · Cj + d con Cj − Zj ${res.maximizar ? '≤' : '≥'} 0`]);
    filas.push(['Variable', 'Significado', 'Situación', 'Cj actual', 'Mínimo', 'Máximo']);
    s.rangosC.forEach((x) => {
      const v = lp.variables[x.k];
      filas.push([v.nombre, v.etiqueta, x.basica ? 'En la base' : 'Fuera de la base', num(lp.objetivo[x.k]), num(x.min), num(x.max)]);
    });
    filas.push([]);
    filas.push(['d) Comprobación con el dual']);
    filas.push(['W = Σ bj · yj', lp.restricciones.map((r, i) => `${S.fmt(r.rhs)}(${S.fmt(s.precios[i].y, { decimales: 6 })})`).join(' + '), num(s.w)]);
    filas.push([Math.abs(s.w - res.z) < 1e-6 ? 'W = Z: se cumple el teorema fuerte de la dualidad' : 'Revisar: W y Z difieren']);
    return hoja(XLSX, filas, [34, 40, 14, 16, 20, 34]);
  }

  /* ---------- exportar ---------- */
  async function exportar(estado, modeloVisto) {
    const XLSX = await cargarLibreria();
    const ids = ['curso'].concat(modeloVisto && modeloVisto !== 'curso' ? [modeloVisto] : []);
    const modelos = ids.map((id) => M.resolverModelo(id, estado));
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'Planificador Simplex KLEINFOR', Author: 'Jaren Jeison Alfaro Porras' };
    XLSX.utils.book_append_sheet(wb, hojaResumen(XLSX, estado, modelos), 'Resumen');
    XLSX.utils.book_append_sheet(wb, hojaParametros(XLSX, estado), 'Parámetros');
    XLSX.utils.book_append_sheet(wb, hojaEstaciones(XLSX, estado), 'Estaciones');
    XLSX.utils.book_append_sheet(wb, hojaMaquinas(XLSX, estado), 'Máquinas');
    XLSX.utils.book_append_sheet(wb, hojaEstudio(XLSX, estado), 'Estudio de tiempos');
    XLSX.utils.book_append_sheet(wb, hojaDAP(XLSX, estado), 'DAP');
    modelos.forEach(({ lp, res }) => {
      const n = NOMBRE_MODELO[lp.id];
      XLSX.utils.book_append_sheet(wb, hojaSimplex(XLSX, lp, res), ('Simplex ' + n).slice(0, 31));
      if (res.estado === 'optimo') XLSX.utils.book_append_sheet(wb, hojaSensibilidad(XLSX, lp, res), ('Sensibilidad ' + n).slice(0, 31));
    });
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `planificador-kleinfor-${fecha}.xlsx`, { compression: true });
  }

  /* ---------- importar ---------- */
  function filasDe(XLSX, wb, nombre) {
    const clave = norm(nombre);
    const n = wb.SheetNames.find((x) => norm(x) === clave);
    if (!n) return null;
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    const h = aoa.findIndex((f) => f.some((c) => ['id', 'clave'].includes(norm(c))));
    if (h < 0) return null;
    const cab = aoa[h].map(norm);
    return aoa.slice(h + 1).map((f) => {
      const o = {};
      cab.forEach((c, i) => { if (c) o[c] = f[i]; });
      return o;
    });
  }
  function numero(v) {
    if (typeof v === 'number') return v;
    const x = parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }
  const distinto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) > 1e-9;
  const FUENTE_EXCEL = 'Dato cargado desde Excel';

  async function importar(archivo, estadoActual) {
    const XLSX = await cargarLibreria();
    const buf = await archivo.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const e = JSON.parse(JSON.stringify(estadoActual));
    const nAntes = M.operariosDisponibles(estadoActual);
    let reconocidas = 0, cambios = 0;

    const est = filasDe(XLSX, wb, 'Estaciones');
    if (est) {
      reconocidas++;
      est.forEach((f) => {
        const s = e.estaciones.find((x) => x.id === String(f.id).trim());
        if (!s) return;
        const op = numero(f.operarios);
        if (op !== null && op >= 0 && distinto(op, s.operarios)) { s.operarios = op; s.opCalidad = 'ingresado'; s.opFuente = FUENTE_EXCEL; cambios++; }
        const t = norm(f['en taller (si/no)']);
        if (t) { const v = t.startsWith('s') || t === 'true' || t === '1'; if (v !== s.enTaller) { s.enTaller = v; cambios++; } }
      });
    }

    const par = filasDe(XLSX, wb, 'Parametros');
    if (par) {
      reconocidas++;
      par.forEach((f) => {
        const clave = String(f.clave).trim();
        const p = e.parametros[clave];
        const v = numero(f.valor);
        if (!p || v === null || v < 0) return;
        const actual = clave === 'operariosDisponibles' ? nAntes : p.valor;
        if (distinto(v, actual)) { p.valor = v; p.calidad = 'ingresado'; p.fuente = FUENTE_EXCEL; cambios++; }
      });
    }

    const maq = filasDe(XLSX, wb, 'Maquinas');
    if (maq) {
      reconocidas++;
      maq.forEach((f) => {
        const q = e.maquinas.find((x) => x.id === String(f.id).trim());
        if (!q) return;
        const c = numero(f.cantidad);
        if (c !== null && c >= 0 && distinto(c, q.cantidad)) { q.cantidad = c; q.calidad = 'ingresado'; q.fuente = FUENTE_EXCEL; cambios++; }
        const sg = numero(f['segundos por camisa']);
        if (!q.vinculo && sg !== null && sg >= 0 && distinto(sg, q.segundos)) { q.segundos = sg; q.calidad = 'ingresado'; q.fuente = FUENTE_EXCEL; cambios++; }
      });
    }

    const tie = filasDe(XLSX, wb, 'Estudio de tiempos');
    if (tie) {
      reconocidas++;
      tie.forEach((f) => {
        const id = String(f.id).trim();
        if (id.toUpperCase() === 'SUPLEMENTO') {
          const v = numero(f['tiempo observado (s)']);
          if (v !== null && v >= 0 && distinto(v, e.estudioTiempos.suplemento)) { e.estudioTiempos.suplemento = v; cambios++; }
          return;
        }
        const el = e.estudioTiempos.elementos.find((x) => x.id === id);
        if (!el) return;
        [['tiempo observado (s)', 'observado', 0], ['valoracion (%)', 'valoracion', 0], ['cada n camisas', 'cadaN', 1]].forEach(([col, campo, min]) => {
          const v = numero(f[col]);
          if (v !== null && v >= min && distinto(v, el[campo])) { el[campo] = v; cambios++; }
        });
      });
    }

    if (!reconocidas) throw new Error('formato');
    return { estado: e, cambios };
  }

  global.ExcelKleinfor = { exportar, importar, cargarLibreria };
})(window);
