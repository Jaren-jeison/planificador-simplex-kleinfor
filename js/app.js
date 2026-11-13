/* ==========================================================================
   Interfaz del Planificador Simplex KLEINFOR
   Sitio estático: sin servidor ni base de datos. Los datos editados se guardan
   en el navegador (localStorage) y se pueden descargar o cargar como Excel.
   Autoría: Jaren Jeison Alfaro Porras
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Simplex;
  const M = window.Modelos;
  const CLAVE_DATOS = 'kleinfor-planificador-datos-v1';
  const CLAVE_PREF = 'kleinfor-planificador-pref-v2';

  const $ = (sel) => document.querySelector(sel);
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function leer(clave) { try { const t = localStorage.getItem(clave); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function escribir(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
  const sinMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function validarEstado(e) {
    if (!e || e.version !== DATOS_ORIGINALES.version || !Array.isArray(e.estaciones) || !Array.isArray(e.dap) || !e.parametros || !e.estudioTiempos) return null;
    return e;
  }

  const app = {
    estado: validarEstado(leer(CLAVE_DATOS)) || clonar(DATOS_ORIGINALES),
    pref: Object.assign({ modelo: 'curso', vista: 'todas', iter: 0, fracciones: false, tema: 'light' }, leer(CLAVE_PREF) || {}),
    esc: null,
  };
  const guardar = () => escribir(CLAVE_DATOS, app.estado);
  const guardarPref = () => escribir(CLAVE_PREF, app.pref);

  /* ---------- Formato ---------- */
  const f = (x, d = 2) => S.fmt(x, { decimales: d });
  const fx = (x) => S.fmt(x, { decimales: 4, fracciones: app.pref.fracciones });
  const fm = (a) => S.fmtM(a, { decimales: 4, fracciones: app.pref.fracciones });
  const SIM = { '<=': '≤', '>=': '≥', '=': '=' };
  const CAL = {
    documentado: ['Documentado', 'Tomado de los informes de la empresa'],
    simulado: ['Simulado', 'El informe aclara que proviene de ciclos simulados'],
    supuesto: ['Supuesto', 'No figura en los informes: reemplázalo con el dato real'],
    ingresado: ['Ingresado', 'Dato ingresado en el planificador'],
  };
  const chip = (cal) => { const c = CAL[cal] || CAL.supuesto; const cls = cal === 'ingresado' ? 'ok' : cal; return `<span class="chip chip-${cls}" title="${esc(c[1])}">${c[0]}</span>`; };
  const lista = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];

  /* ---------- Glosario y ayudas "?" ---------- */
  const GLOSARIO = {
    docs: ['Documentación de la empresa', 'Informes del equipo sobre KLEINFOR: Ingeniería de Procesos (Word, Capítulo I) e Ingeniería de Métodos (PDF de toma de tiempos con el DAP de 36 actividades).'],
    holgura: ['Holgura (h)', 'Lo que sobra de un recurso en la solución. Una holgura de 0 significa que el recurso se agota y es el que limita.'],
    'precio-sombra': ['Precio sombra', 'Cuánto aumenta Z si se agrega una unidad más de un recurso (un segundo, un operario, una camisa de cota). Si el recurso sobra, vale 0.'],
    'cj-zj': ['Cj − Zj', 'Cuánto mejoraría Z si la variable de esa columna entra a la solución. Al maximizar entra la de mayor valor positivo; cuando todos son 0 o negativos, la tabla es óptima.'],
    razon: ['Razón de cambio (R/C)', 'bj dividido entre el coeficiente de la columna que entra. Sale de la base la fila con la menor razón positiva.'],
    pivote: ['Elemento pivote', 'El número donde se cruzan la columna que entra y la fila que sale. Con él se hacen las operaciones de Gauss-Jordan.'],
    binv: ['B⁻¹', 'Matriz que se lee en la tabla óptima, en las columnas de las holguras iniciales. Sirve para recalcular la solución cuando cambia un recurso sin resolver todo de nuevo.'],
    rango: ['Rango de sensibilidad', 'Intervalo en el que un dato puede cambiar sin que cambien las variables que forman la solución óptima.'],
    cuello: ['Cuello de botella', 'La estación con menos capacidad. Ella fija cuántas camisas puede terminar toda la planta.'],
    capacidad: ['Capacidad', 'Camisas que una estación puede terminar en una jornada: operarios × segundos de la jornada ÷ segundos por camisa.'],
    'operario-jornada': ['Operario-jornada', 'Una persona trabajando una jornada completa. 13.5 operarios-jornada equivalen a 13 personas y media jornada de otra.'],
    reparto: ['Reparto óptimo', 'Distribución del personal entre estaciones que calcula el Simplex para producir lo máximo con las personas disponibles.'],
    supuesto: ['Dato supuesto', 'Valor que no aparece en los informes y se cargó para poder calcular. Reemplázalo con el dato real de la planta.'],
    'tiempo-estandar': ['Tiempo estándar', 'Tiempo normal de la operación más los suplementos por necesidades personales y fatiga. Para el botonado es 43.08 s por camisa.'],
    dual: ['Dual', 'Modelo espejo del original. Sus variables son los precios sombra y su valor óptimo W es igual a Z.'],
  };
  function info(clave) {
    const g = GLOSARIO[clave];
    if (!g) return '';
    return `<button type="button" class="tip" data-tip="${clave}" aria-label="Qué significa: ${esc(g[0])}" aria-expanded="false">?</button>`;
  }
  let popover = null;
  function mostrarTip(btn) {
    cerrarTip();
    const g = GLOSARIO[btn.dataset.tip];
    if (!g) return;
    popover = document.createElement('div');
    popover.className = 'popover'; popover.setAttribute('role', 'tooltip');
    popover.innerHTML = `<strong>${esc(g[0])}</strong>${esc(g[1])}`;
    document.body.appendChild(popover);
    const r = btn.getBoundingClientRect();
    const w = popover.offsetWidth, h = popover.offsetHeight;
    const left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = r.top - h - 8;
    popover.style.left = left + 'px'; popover.style.top = top + 'px';
    btn.setAttribute('aria-expanded', 'true');
    popover._btn = btn;
  }
  function cerrarTip() {
    if (!popover) return;
    if (popover._btn) popover._btn.setAttribute('aria-expanded', 'false');
    popover.remove(); popover = null;
  }

  function toast(texto) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  /* ---------- Rutas ---------- */
  const RUTAS = {
    inicio: { grupo: 'Inicio', titulo: 'Bienvenida', render: vistaInicio },
    planteamiento: { grupo: 'Resolución del modelo', titulo: '1. Planteamiento del modelo', render: vistaPlanteamiento, curso: true },
    tablas: { grupo: 'Resolución del modelo', titulo: '2. Tablas Simplex paso a paso', render: vistaTablas, curso: true },
    sensibilidad: { grupo: 'Resolución del modelo', titulo: '3. Análisis de sensibilidad', render: vistaSensibilidad, curso: true },
    diagnostico: { grupo: 'Aplicación en la planta', titulo: 'Diagnóstico de producción', render: vistaDiagnostico, planta: true },
    simulador: { grupo: 'Aplicación en la planta', titulo: 'Simulador ¿qué pasa si?', render: vistaSimulador, planta: true },
    datos: { grupo: 'Aplicación en la planta', titulo: 'Datos de la empresa', render: vistaDatos, planta: true },
    tiempo: { grupo: 'Aplicación en la planta', titulo: 'Tiempo estándar del botonado', render: vistaTiempo, planta: true },
    guia: { grupo: 'Ayuda', titulo: 'Guía de uso y glosario', render: vistaGuia },
  };
  const ALIAS = { tablero: 'diagnostico', escenarios: 'simulador', modelos: 'planteamiento', simplex: 'tablas' };
  function rutaActual() {
    let h = location.hash.replace('#', '');
    if (ALIAS[h]) h = ALIAS[h];
    return RUTAS[h] ? h : 'inicio';
  }

  function render(animar) {
    cerrarTip();
    const r = rutaActual();
    document.querySelectorAll('.nav-link').forEach((a) => {
      if (a.dataset.ruta === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#ruta').innerHTML = `${esc(RUTAS[r].grupo)} / <strong>${esc(RUTAS[r].titulo)}</strong>`;
    document.title = RUTAS[r].titulo.replace(/^\d\.\s/, '') + ' · Planificador Simplex KLEINFOR';
    const vista = $('#vista');
    vista.innerHTML = RUTAS[r].render();
    actualizarChipDatos(RUTAS[r].planta);
    actualizarBotonTema();
    if (animar && !sinMovimiento()) {
      [...vista.children].forEach((ch, i) => ch.style.setProperty('--i', Math.min(i, 8)));
      vista.classList.remove('animar'); void vista.offsetWidth; vista.classList.add('animar');
      setTimeout(() => vista.classList.remove('animar'), 1600);
      contarNumeros(vista);
    }
  }

  function contarNumeros(raiz) {
    raiz.querySelectorAll('[data-contar]').forEach((el) => {
      const fin = parseFloat(el.dataset.contar);
      const dec = Number(el.dataset.dec || 0);
      if (!isFinite(fin)) return;
      const t0 = performance.now(), dur = 750;
      const paso = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = f(fin * e, dec);
        if (p < 1) requestAnimationFrame(paso); else el.textContent = f(fin, dec);
      };
      requestAnimationFrame(paso);
    });
  }

  function contarSupuestos() {
    const e = app.estado;
    let n = 0;
    e.estaciones.forEach((x) => { if (x.enTaller && x.opCalidad === 'supuesto') n++; });
    Object.values(e.parametros).forEach((p) => { if (p.calidad === 'supuesto') n++; });
    e.maquinas.forEach((m) => { if (m.calidad === 'supuesto') n++; });
    return n;
  }
  function actualizarChipDatos(visible) {
    const el = $('#chip-datos');
    const n = contarSupuestos();
    el.hidden = !visible;
    el.className = 'chip ' + (n ? 'chip-supuesto' : 'chip-ok');
    el.textContent = n ? `${n} datos por confirmar` : 'Datos confirmados';
    el.title = n ? 'Datos que no figuran en los informes de la empresa. Revísalos en Datos de la empresa.' : 'Todos los datos provienen de los informes o fueron ingresados.';
  }

  const ICONO_LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const ICONO_SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function actualizarBotonTema() {
    const oscuro = document.documentElement.dataset.theme === 'dark';
    const b = $('#btn-tema');
    b.innerHTML = oscuro ? ICONO_SOL : ICONO_LUNA;
    b.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  }

  function encabezado(origen, eyebrow, titulo, texto) {
    const etq = origen === 'curso' ? '<span class="etq-origen curso">Metodología del curso</span>' : origen === 'empresa' ? '<span class="etq-origen empresa">Documentación de la empresa</span>' : '';
    return `<header class="encabezado"><span class="eyebrow">${etq}${esc(eyebrow)}</span><h1>${esc(titulo)}</h1>${texto ? `<p>${texto}</p>` : ''}</header>`;
  }
  function ayuda(titulo, contenido) {
    return `<details class="ayuda"><summary>${esc(titulo)}</summary><div class="contenido">${contenido}</div></details>`;
  }
  function pasoNav(prev, next) {
    return `<nav class="paso-nav" aria-label="Pasos">${prev ? `<a class="btn" href="#${prev[0]}">← ${esc(prev[1])}</a>` : '<span></span>'}${next ? `<a class="btn btn-primario" href="#${next[0]}">${esc(next[1])} →</a>` : ''}</nav>`;
  }

  /* ==========================================================================
     INICIO
     ========================================================================== */
  function vistaInicio() {
    const curso = M.resolverModelo('curso', app.estado);
    const ind = M.indicadores(app.estado);
    const zc = curso.res.estado === 'optimo' ? curso.res.z : 0;
    return `
      <section class="inicio-hero">
        <span class="eyebrow" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent-ink);font-weight:600">Industrias KLEINFOR E.I.R.L. · Investigación Operativa I</span>
        <h1>Planificador de producción con el método Simplex</h1>
        <p>Resuelve paso a paso, con la metodología usada en clase, el modelo de programación lineal que el equipo planteó a partir del análisis de la planta de camisas de KLEINFOR, y lo amplía con los datos de sus informes de Procesos y de Métodos. Elige por dónde empezar.</p>
      </section>

      <div class="caminos">
        <article class="camino curso">
          <div class="camino-cab">
            <div class="camino-icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h6"/></svg></div>
            <div><span class="etq-origen curso">Metodología del curso</span><h2 style="margin-top:6px">Resolución del modelo por tallas</h2></div>
          </div>
          <p>El modelo que planteó el equipo a partir del análisis de la empresa, resuelto con la metodología del curso: cuántas camisas de cada talla producir por jornada. <span class="mono">Max Z = x₁ + x₂ + x₃</span>, con el tiempo de ojales y botones y la capacidad de planta.</p>
          <div class="camino-resultado"><span class="etq">Resultado</span><strong>Z = <span data-contar="${zc}" data-dec="0">${f(zc, 0)}</span> camisas por jornada</strong></div>
          <ol class="camino-pasos">
            <li><a href="#planteamiento"><span class="n">1</span><span>Planteamiento del modelo<small>Variables, forma canónica y forma estándar</small></span></a></li>
            <li><a href="#tablas"><span class="n">2</span><span>Tablas Simplex paso a paso<small>Método Cj − Zj con V.E., V.S. y pivote</small></span></a></li>
            <li><a href="#sensibilidad"><span class="n">3</span><span>Análisis de sensibilidad<small>Precios sombra, rangos de bj y de Cj</small></span></a></li>
          </ol>
          <a class="btn btn-primario" href="#planteamiento">Ver la resolución →</a>
        </article>

        <article class="camino empresa">
          <div class="camino-cab">
            <div class="camino-icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21V9l6 4V9l6 4V5l6 4v12z"/><path d="M7 17h2M12 17h2M17 17h2"/></svg></div>
            <div><span class="etq-origen empresa">Documentación de la empresa</span><h2 style="margin-top:6px">Aplicación en la planta</h2></div>
          </div>
          <p>Los mismos cálculos con todas las estaciones del DAP y el estudio de tiempos: dónde se frena la producción, cómo repartir al personal y qué pasa si algo cambia.</p>
          <div class="camino-resultado"><span class="etq">Hoy, con el personal cargado</span><strong><span data-contar="${ind.capacidadActual}" data-dec="1">${f(ind.capacidadActual, 1)}</span> camisas por jornada · frena ${esc(ind.c.limite.nombre)}</strong></div>
          <ol class="camino-pasos">
            <li><a href="#diagnostico"><span class="n">→</span><span>Diagnóstico de producción<small>Cuello de botella y personal por estación</small></span></a></li>
            <li><a href="#simulador"><span class="n">→</span><span>Simulador ¿qué pasa si?<small>Jornada, pedido, personal y método</small></span></a></li>
            <li><a href="#datos"><span class="n">→</span><span>Datos de la empresa<small>DAP, máquinas y fuentes de cada dato</small></span></a></li>
          </ol>
          <a class="btn" href="#diagnostico">Ver el diagnóstico →</a>
        </article>
      </div>

      <section class="panel">
        <div class="panel-cab"><h2>De dónde salen los datos</h2></div>
        <div class="fuentes-tira">
          <div class="fuente-doc"><strong>Modelo del equipo</strong>Excel de sensibilidad y presentación: tallas S, M y L, 43.08 s por camisa, 28 800 s y 200 camisas.</div>
          <div class="fuente-doc"><strong>Ingeniería de Métodos (PDF)</strong>DAP de 36 actividades y estudio de tiempos del botonado.</div>
          <div class="fuente-doc"><strong>Ingeniería de Procesos (Word)</strong>Jornada, producción de referencia, operarios y mantenimiento.</div>
        </div>
      </section>`;
  }

  /* ==========================================================================
     SELECTOR DE MODELO (páginas de resolución)
     ========================================================================== */
  function selectorModelo() {
    const p = app.pref.modelo;
    return `
      <div class="selector-modelo" role="group" aria-label="Modelo que se muestra">
        <button type="button" class="opcion-curso" data-accion="modelo" data-modelo="curso" aria-pressed="${p === 'curso'}">
          <span class="opcion-tit">Producción por tallas (S, M y L)</span><span class="opcion-sub">Modelo principal del trabajo · metodología del curso</span>
        </button>
        <div class="opciones-planta">
          <span class="opcion-etq">Ver también con la documentación de la empresa ${info('docs')}</span>
          <div class="grupo">
            <button type="button" data-accion="modelo" data-modelo="actual" aria-pressed="${p === 'actual'}">Capacidad con el personal actual</button>
            <button type="button" data-accion="modelo" data-modelo="optimo" aria-pressed="${p === 'optimo'}">Mejor reparto del personal</button>
          </div>
        </div>
      </div>
      ${p !== 'curso' ? `<div class="aviso empresa"><div><strong>Estás viendo un modelo ampliado de la planta.</strong> Usa todas las estaciones del DAP y los informes de la empresa, con la misma metodología del curso. <button type="button" class="enlace" data-accion="modelo" data-modelo="curso">Volver al modelo por tallas</button></div></div>` : ''}`;
  }

  /* ==========================================================================
     1. PLANTEAMIENTO
     ========================================================================== */
  function terminos(coefs, nombres) {
    const partes = [];
    coefs.forEach((c, j) => {
      if (Math.abs(c) < 1e-12) return;
      const abs = Math.abs(c);
      const txt = (Math.abs(abs - 1) < 1e-12 ? '' : S.fmt(abs, { decimales: 4 })) + nombres[j];
      if (!partes.length) partes.push((c < 0 ? '−' : '') + txt);
      else partes.push((c < 0 ? ' − ' : ' + ') + txt);
    });
    return partes.join('') || '0';
  }

  function formulacion(lp, res) {
    const vars = lp.variables.map((v) => v.nombre);
    const sentido = lp.sentido === 'max' ? 'Max' : 'Min';
    const canon = [`${sentido} Z = ${terminos(lp.objetivo, vars)}`, '<span class="sr">S.R.</span>']
      .concat(lp.restricciones.map((r) => `&nbsp;&nbsp;${terminos(r.coef, vars)} ${SIM[r.tipo]} ${S.fmt(r.rhs, { decimales: 4 })}&nbsp;&nbsp;<span class="sr">(${esc(r.nombre)})</span>`))
      .concat([`&nbsp;&nbsp;${vars.join(', ')} ≥ 0`]);
    const cols = res.cols;
    const todos = cols.length - vars.length <= 5;
    const objTxt = cols.map((c) => {
      if (c.tipo === 'dec') return null;
      if (Math.abs(c.costo[1]) > 1e-12) return (c.costo[1] < 0 ? ' − M' : ' + M') + c.nombre;
      return (c.tipo === 's' ? ' − 0' : ' + 0') + c.nombre;
    }).filter(Boolean).join('');
    const est = [`${sentido} Z = ${terminos(lp.objetivo, vars)}${objTxt}`, '<span class="sr">S.R.</span>'];
    res.restr.forEach((r, i) => {
      const extra = cols.map((c, j) => {
        if (c.tipo === 'dec') return null;
        const a = res.iteraciones[0].A[i][j];
        if (!todos && Math.abs(a) < 1e-12) return null;
        return (a < 0 ? ' − ' : ' + ') + (Math.abs(Math.abs(a) - 1) < 1e-12 ? '' : S.fmt(Math.abs(a))) + c.nombre;
      }).filter(Boolean).join('');
      est.push(`&nbsp;&nbsp;${terminos(r.coef, vars)}${extra} = ${S.fmt(r.rhs, { decimales: 4 })}`);
    });
    est.push(`&nbsp;&nbsp;${cols.map((c) => c.nombre).join(', ')} ≥ 0`);
    return { canon: canon.join('<br>'), est: est.join('<br>'), todos };
  }

  function textoHolgura(lp, c) {
    const r = lp.restricciones[c.restr];
    if (c.tipo === 'A') return `variable artificial de «${r.nombre}»`;
    if (c.tipo === 's') return `exceso sobre el mínimo de «${r.nombre}»`;
    if (r.holgura) return r.holgura;
    if (r.clase === 'estacion') return `segundos libres en ${r.nombre}`;
    if (r.clase === 'maquina') return `segundos libres de la ${r.nombre.replace('Máquina: ', 'máquina ').toLowerCase()}`;
    if (r.clase === 'personal') return 'operarios sin asignar';
    if (r.clase === 'pedido') return 'camisas que faltan para el pedido';
    return `lo que sobra en «${r.nombre}»`;
  }

  function leyendaColumnas(lp, res, conHolguras) {
    const partes = lp.variables.map((v) => `<span><b>${esc(v.nombre)}</b> = ${esc(v.etiqueta)}</span>`);
    if (conHolguras) res.cols.forEach((c) => { if (c.tipo !== 'dec') partes.push(`<span><b>${esc(c.nombre)}</b> = ${esc(textoHolgura(lp, c))}</span>`); });
    return `<div class="leyenda-vars">${partes.join('')}</div>`;
  }

  function tablaRestricciones(lp, res) {
    return `<div class="tabla-envoltura"><table class="datos">
      <thead><tr><th>Restricción</th><th class="n">Usado</th><th class="n">Disponible</th><th class="n">Holgura</th><th>Estado</th></tr></thead>
      <tbody>${lp.restricciones.map((r) => {
        let usado = 0, disp = r.rhs;
        r.coef.forEach((a, j) => { const v = res.valores[j] || 0; if (a > 0) usado += a * v; else disp += -a * v; });
        const h = disp - usado;
        const activa = Math.abs(h) < 1e-6;
        return `<tr><td>${esc(r.nombre)}<br><span class="fuente">${esc(r.detalle || '')}</span></td><td class="n">${f(usado, 2)}</td><td class="n">${f(disp, 2)}</td><td class="n">${f(h, 2)}</td><td>${activa ? '<span class="chip chip-crit">Se agota: limita</span>' : '<span class="chip chip-ok">Sobra</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function interpretacion(id, lp, res) {
    if (res.estado !== 'optimo') return '';
    const s = res.sensibilidad;
    const z = res.z;
    const items = [];
    if (id === 'actual') {
      const lim = lp.restricciones.map((r, i) => ({ r, y: s.precios[i].y, i })).filter((x) => x.y > 1e-9);
      items.push(`Con el personal actual la planta produce como máximo <b>${f(z, 2)} camisas por jornada</b>.`);
      lim.forEach((x) => items.push(`La frena <b>${esc(x.r.nombre)}</b>: cada hora adicional ahí suma <b>${f(x.y * 3600, 2)} camisas</b> (precio sombra), hasta unas ${f((s.rangosB[x.i].max - x.r.rhs) / 3600, 2)} horas extra.`));
      const holg = lp.restricciones.map((r, i) => ({ r, h: res.valores[res.colHolgura[i]] || 0 })).filter((x) => x.h > 1).sort((a, b) => b.h - a.h).slice(0, 3);
      if (holg.length) items.push(`Tienen más tiempo libre: ${holg.map((x) => `${esc(x.r.nombre)} (${f(x.h / 3600, 1)} h)`).join(', ')}. Agregar personal ahí no aumenta la producción.`);
    } else if (id === 'optimo') {
      const iPers = lp.restricciones.findIndex((r) => r.clase === 'personal');
      const iPed = lp.restricciones.findIndex((r) => r.clase === 'pedido');
      items.push(`El reparto óptimo produce <b>${f(z, 2)} camisas por jornada</b> con ${f(lp.restricciones[iPers].rhs, 2)} operarios disponibles.`);
      if (s.precios[iPers].y > 1e-9) items.push(`Limita el personal: <b>cada operario adicional suma ${f(s.precios[iPers].y, 2)} camisas</b> (precio sombra), hasta ${f(s.rangosB[iPers].max, 2)} operarios; desde ahí limita el pedido.`);
      if (s.precios[iPed].y > 1e-9) items.push(`Limita el pedido: se cumplen las ${f(lp.restricciones[iPed].rhs, 0)} camisas y sobran ${f(res.valores[res.colHolgura[iPers]] || 0, 2)} operarios-jornada.`);
      items.push(`Asignación: ${lp.variables.slice(1).map((v, k) => `${esc(v.etiqueta.replace('Operarios en ', ''))} ${f(res.valores[k + 1], 2)}`).join(' · ')}.`);
    } else {
      const alternativas = lp.variables.filter((_, k) => !res.final.base.includes(k) && Math.abs(res.final.delta[k][0]) < 1e-9 && Math.abs(res.final.delta[k][1]) < 1e-9);
      items.push(`Conviene producir <b>${f(z, 0)} camisas por jornada</b>: ${lp.variables.map((v, k) => `${v.nombre} = ${f(res.valores[k], 2)}`).join(', ')}.`);
      lp.restricciones.forEach((r, i) => {
        const h = res.valores[res.colHolgura[i]] || 0;
        items.push(`<b>${esc(r.nombre)}</b>: ${h > 1e-6 ? `sobran ${f(h, 2)} ${esc(r.unidad === 's' ? 'segundos' : r.unidad)} (precio sombra 0: no conviene aumentarlo).` : `se usa por completo (precio sombra ${f(s.precios[i].y, 2)}: cada unidad adicional sube Z en ${f(s.precios[i].y, 2)}).`}`);
      });
      if (alternativas.length) items.push(`${alternativas.map((v) => v.nombre).join(' y ')} tienen Cj − Zj = 0 sin estar en la base: hay <b>soluciones óptimas alternativas</b>. Cualquier mezcla de tallas que sume ${f(z, 0)} camisas da el mismo resultado.`);
    }
    return `<ul class="lista-acciones">${items.map((t, i) => `<li class="accion"><span class="accion-icono info">${i + 1}</span><div><p>${t}</p></div></li>`).join('')}</ul>`;
  }

  function mensajeEstado(res) {
    if (res.estado === 'no_acotado') return '<div class="aviso crit"><div><strong>El problema no está acotado.</strong> Ninguna razón de cambio es positiva: revisa que existan restricciones de capacidad.</div></div>';
    if (res.estado === 'infactible') return '<div class="aviso crit"><div><strong>No hay solución factible.</strong> Queda una variable artificial positiva en el tablero final: las restricciones se contradicen.</div></div>';
    if (res.estado !== 'optimo') return '<div class="aviso crit"><div><strong>Se alcanzó el límite de iteraciones.</strong></div></div>';
    return '';
  }

  function enunciadoCurso(lp) {
    const t = lp.restricciones[0].coef[0];
    return `
      <section class="panel">
        <div class="panel-cab"><h2>¿Qué decide el modelo?</h2></div>
        <div class="enunciado">
          <p>Cuántas camisas de cada talla (<b>S, M y L</b>) producir en una jornada para <b>maximizar el total</b>, sin pasar del tiempo disponible en la estación de ojales y botones ni de la capacidad de la planta.</p>
          <div class="tabla-envoltura" style="margin-top:6px"><table class="datos">
            <thead><tr><th>Dato del modelo</th><th class="n">Valor</th><th>De dónde sale</th></tr></thead>
            <tbody>
              <tr><td>Tiempo por camisa en ojales y botones ${info('tiempo-estandar')}</td><td class="n">${f(t, 2)} s</td><td class="small">Estudio de tiempos (PDF de Métodos). Ver <a href="#tiempo">cómo se calcula</a></td></tr>
              <tr><td>Tiempo disponible en la jornada</td><td class="n">${f(lp.restricciones[0].rhs, 0)} s</td><td class="small">${f(lp.restricciones[0].rhs / 3600, 1)} horas × 3600 s (Word de Procesos)</td></tr>
              <tr><td>Capacidad de planta</td><td class="n">${f(lp.restricciones[1].rhs, 0)} camisas</td><td class="small">Producción de referencia por jornada (Word de Procesos)</td></tr>
              <tr><td>Aporte de cada camisa a Z</td><td class="n">1</td><td class="small">Z cuenta camisas, sin distinguir talla</td></tr>
            </tbody>
          </table></div>
        </div>
      </section>`;
  }

  function vistaPlanteamiento() {
    const id = app.pref.modelo;
    const { lp, res } = M.resolverModelo(id, app.estado);
    const fo = formulacion(lp, res);
    const esCurso = id === 'curso';
    return `
      ${encabezado(esCurso ? 'curso' : 'empresa', 'Paso 1 de 3', 'Planteamiento del modelo',
        esCurso ? 'El modelo de programación lineal del equipo: qué se decide, con qué datos y cómo queda en forma canónica y estándar antes de aplicar el Simplex.' : esc(lp.pregunta))}
      ${selectorModelo()}
      ${esCurso ? enunciadoCurso(lp) : `<section class="panel"><p style="color:var(--heading);font-weight:600">${esc(lp.pregunta)}</p><p class="muted" style="margin-top:6px">${esc(lp.lectura)}</p></section>`}
      <section class="panel">
        <div class="panel-cab"><h2>Variables de decisión</h2><p>Lo que el modelo calcula</p></div>
        <div class="tabla-envoltura"><table class="datos"><thead><tr><th>Variable</th><th>Significado</th><th>Unidad</th></tr></thead>
        <tbody>${lp.variables.map((v) => `<tr><td class="mono">${esc(v.nombre)}</td><td>${esc(v.etiqueta)}</td><td class="small">${esc(v.unidad)} por jornada</td></tr>`).join('')}</tbody></table></div>
      </section>
      <div class="rejilla">
        <section class="panel"><div class="panel-cab"><h3>Forma canónica</h3><p>Con desigualdades</p></div><div class="formula">${fo.canon}</div></section>
        <section class="panel"><div class="panel-cab"><h3>Forma estándar ${info('holgura')}</h3><p>Se suma una holgura h a cada ≤</p></div><div class="formula">${fo.est}</div>
          <div style="margin-top:10px">${leyendaColumnas(lp, res, true)}</div></section>
      </div>
      ${mensajeEstado(res)}
      ${res.estado === 'optimo' ? `
      <div class="rejilla rejilla-2">
        <section class="panel">
          <div class="panel-cab"><h2>Solución óptima</h2><span class="chip chip-ok">${res.iteraciones.length - 1} ${res.iteraciones.length - 1 === 1 ? 'iteración' : 'iteraciones'}</span></div>
          <div class="kpi-valor" style="margin-bottom:12px">Z = <span data-contar="${res.z}" data-dec="2">${f(res.z, 4)}</span></div>
          <div class="tabla-envoltura"><table class="datos"><thead><tr><th>Variable</th><th>Significado</th><th class="n">Valor</th></tr></thead>
          <tbody>${lp.variables.map((v, k) => `<tr><td class="mono">${esc(v.nombre)}</td><td>${esc(v.etiqueta)}</td><td class="n">${f(res.valores[k], 4)}</td></tr>`).join('')}</tbody></table></div>
        </section>
        <section class="panel"><div class="panel-cab"><h2>Qué significa</h2></div>${interpretacion(id, lp, res)}</section>
      </div>
      <section class="panel"><div class="panel-cab"><h2>Uso de los recursos</h2><p>Cuánto se usa de cada restricción en la solución</p></div>${tablaRestricciones(lp, res)}</section>` : ''}
      ${pasoNav(['inicio', 'Inicio'], ['tablas', 'Siguiente: Tablas Simplex'])}`;
  }

  /* ==========================================================================
     2. TABLAS SIMPLEX (formato del curso)
     ========================================================================== */
  function tablaSimplex(lp, res, t, idx, total, paso) {
    const cols = res.cols;
    const ultima = idx === total - 1;
    const titulo = idx === 0 ? 'Tabla inicial' : (ultima && res.estado === 'optimo' ? `Tabla ${idx + 1} · solución óptima` : `Tabla ${idx + 1}`);
    const sub = idx === 0 ? 'Base con las holguras' : `Después de la iteración ${idx}`;
    const hayRC = !!t.razones;
    const clase = (r, j) => {
      if (r === t.sale && j === t.entra) return 'piv';
      if (r === t.sale) return 'fila-piv';
      if (j === t.entra) return 'col-piv';
      return '';
    };
    let h = `<div class="tabla-titulo"><h3>${titulo}</h3><span class="muted small">${sub}</span>${t.regla === 'Bland' ? '<span class="chip chip-warn">Regla de Bland</span>' : ''}</div><div class="tabla-simplex-env"><table class="simplex">`;
    h += `<thead><tr><th class="vacio"></th><th class="cab" colspan="2">Cj →</th>${cols.map((c) => `<th class="cab">${esc(c.nombre)}</th>`).join('')}<th class="cab" rowspan="2">bj</th>${hayRC ? '<th class="cab" rowspan="2">R/C</th>' : ''}<th class="vacio" rowspan="2"></th></tr>`;
    h += `<tr><th class="vacio"></th><th class="cab">Base</th><th class="cab">CB</th>${cols.map((c) => `<th class="cab">${fm(c.costo)}</th>`).join('')}</tr></thead><tbody>`;
    t.A.forEach((fila, r) => {
      const op = t.ops ? t.ops[r].texto : t.etiquetas[r];
      h += `<tr><td class="op">${esc(op)}</td><td class="base">${esc(cols[t.base[r]].nombre)}</td><td>${fm(t.CB[r])}</td>`;
      fila.forEach((v, j) => { h += `<td class="${clase(r, j)}">${fx(v)}</td>`; });
      h += `<td class="${r === t.sale ? 'fila-piv' : ''}">${fx(t.b[r])}</td>`;
      if (hayRC) h += `<td>${t.razones[r] === null ? '—' : fx(t.razones[r])}</td>`;
      h += `<td class="marca-vs">${r === t.sale ? 'V.S.' : ''}</td></tr>`;
    });
    h += `<tr class="zj"><td class="vacio"></td><td class="cab" colspan="2">Zj</td>${t.Zj.map((v, j) => `<td class="${j === t.entra ? 'col-piv' : ''}">${fm(v)}</td>`).join('')}<td>${fm(t.Zb)}</td>${hayRC ? '<td class="vacio"></td>' : ''}<td class="vacio"></td></tr>`;
    const maximizar = res.maximizar;
    h += `<tr class="cz"><td class="vacio"></td><td class="cab" colspan="2">Cj − Zj</td>${t.delta.map((v, j) => {
      const bueno = maximizar ? S.MV.signo(v) > 0 : S.MV.signo(v) < 0;
      return `<td class="${j === t.entra ? 'col-piv' : ''} ${bueno && !t.base.includes(j) ? 'positivo' : ''}">${fm(v)}</td>`;
    }).join('')}<td class="vacio"></td>${hayRC ? '<td class="vacio"></td>' : ''}<td class="vacio"></td></tr>`;
    if (t.entra !== null) h += `<tr><td class="vacio" colspan="3"></td>${cols.map((_, j) => j === t.entra ? '<td class="marca-ve">V.E.</td>' : '<td class="vacio"></td>').join('')}</tr>`;
    h += '</tbody></table></div>';

    let exp = '';
    if (t.entra !== null) {
      exp += `<b>Qué pasa aquí:</b> entra <b>${esc(cols[t.entra].nombre)}</b> porque su Cj − Zj (${fm(t.delta[t.entra])}) es el ${maximizar ? 'mayor positivo' : 'más negativo'}. `;
      if (t.sale !== null) exp += `Sale <b>${esc(cols[t.base[t.sale]].nombre)}</b> por la menor razón de cambio (${fx(t.razones[t.sale])}). El pivote es <b>${fx(t.pivote)}</b>; con él se hacen las operaciones que aparecen a la izquierda de la tabla siguiente.`;
      else exp += 'Ninguna razón de cambio es positiva: el problema no está acotado.';
      if (t.razones && t.sale !== null && Math.abs(t.razones[t.sale]) < 1e-9) exp += ' La razón es 0 (pivoteo degenerado): Z no cambia en esta iteración.';
    } else if (res.estado === 'optimo') {
      exp = `<b>Fin:</b> todos los valores Cj − Zj son ${maximizar ? 'ceros o negativos' : 'ceros o positivos'}, así que se encontró la solución factible óptima: ${t.base.map((j, r) => `${esc(cols[j].nombre)} = ${fx(t.b[r])}`).join(', ')} y Z = ${fm(t.Zb)}.`;
    } else if (res.estado === 'infactible') {
      exp = 'Queda una variable artificial positiva: el problema no tiene solución factible.';
    }
    return `<section class="panel ${paso ? 'tabla-paso' : ''}">${h}<p class="tabla-explica">${exp}</p></section>`;
  }

  function vistaTablas() {
    const id = app.pref.modelo;
    const { lp, res } = M.resolverModelo(id, app.estado);
    const total = res.iteraciones.length;
    const paso = app.pref.vista === 'paso';
    const k = Math.min(Math.max(0, app.pref.iter || 0), total - 1);
    const tablas = paso ? [k] : res.iteraciones.map((_, i) => i);
    return `
      ${encabezado(id === 'curso' ? 'curso' : 'empresa', 'Paso 2 de 3', 'Tablas Simplex paso a paso',
        'Resolución con el método Cj − Zj, como en clase. En cada tabla se marca la variable que entra (V.E.), la que sale (V.S.) y el elemento pivote; a la izquierda de cada fila está su operación de Gauss-Jordan.')}
      ${selectorModelo()}
      ${ayuda('¿Cómo se lee una tabla Simplex?', `
        <p><b>1.</b> Se calcula Zj = suma de (CB × columna) y luego Cj − Zj ${info('cj-zj')}.</p>
        <p><b>2.</b> Entra la variable con el mayor Cj − Zj positivo (columna azul).</p>
        <p><b>3.</b> Se divide bj entre esa columna: la menor razón positiva ${info('razon')} indica la fila que sale (fila verde).</p>
        <p><b>4.</b> Con el pivote ${info('pivote')} (celda naranja) se hace Gauss-Jordan: la fila pivote se divide entre el pivote y a las demás se les resta un múltiplo.</p>
        <p><b>5.</b> Cuando todos los Cj − Zj son 0 o negativos, la tabla es óptima.</p>`)}
      <section class="panel">
        <div class="barra-herr" style="justify-content:space-between">
          <div class="segmentos" role="group" aria-label="Modo de vista">
            <button type="button" data-accion="vista" data-vista="todas" aria-pressed="${!paso}">Ver todas las tablas</button>
            <button type="button" data-accion="vista" data-vista="paso" aria-pressed="${paso}">Una tabla a la vez</button>
          </div>
          ${paso ? `<div class="barra-herr"><button class="btn" type="button" data-accion="iter" data-delta="-1" ${k === 0 ? 'disabled' : ''}>← Anterior</button><span class="num">Tabla ${k + 1} de ${total}</span><button class="btn btn-primario" type="button" data-accion="iter" data-delta="1" ${k === total - 1 ? 'disabled' : ''}>Siguiente →</button></div>` : `<span class="muted small">${total} tablas · ${total - 1} ${total - 1 === 1 ? 'iteración' : 'iteraciones'}</span>`}
          <div class="barra-herr"><label class="campo-fila small" for="fr"><input type="checkbox" id="fr" data-pref="fracciones" ${app.pref.fracciones ? 'checked' : ''}> Mostrar fracciones</label><button class="btn" type="button" data-accion="exportar">Descargar en Excel</button></div>
        </div>
        <div class="leyenda-colores" style="margin-top:14px">
          <span><i style="background:var(--pivot)"></i>Elemento pivote</span>
          <span><i style="background:var(--pivot-row)"></i>Fila que sale (V.S.)</span>
          <span><i style="background:var(--pivot-col)"></i>Columna que entra (V.E.)</span>
        </div>
        <div style="margin-top:12px"><span class="small muted">Qué es cada columna:</span>${leyendaColumnas(lp, res, true)}</div>
      </section>
      ${mensajeEstado(res)}
      ${tablas.map((i) => tablaSimplex(lp, res, res.iteraciones[i], i, total, paso)).join('')}
      ${pasoNav(['planteamiento', 'Planteamiento'], ['sensibilidad', 'Siguiente: Análisis de sensibilidad'])}`;
  }

  /* ==========================================================================
     3. SENSIBILIDAD
     ========================================================================== */
  function rangoTxt(min, max, nombre) {
    const izq = isFinite(min) ? `${f(min, 4)} ≤ ` : '−∞ < ';
    const der = isFinite(max) ? ` ≤ ${f(max, 4)}` : ' < ∞';
    return izq + nombre + der;
  }

  function lecturaPrecio(lp, r, y) {
    if (r.clase === 'estacion' || r.clase === 'maquina') {
      if (lp.id === 'curso') return `${f(y, 4)} camisas por segundo adicional`;
      return `${f(y * 3600, 2)} camisas por hora adicional`;
    }
    if (r.clase === 'personal') return `${f(y, 2)} camisas por operario adicional`;
    if (r.clase === 'pedido') return `Z sube ${f(y, 2)} por cada camisa adicional de capacidad`;
    return `${f(y, 4)} por unidad`;
  }

  function vistaSensibilidad() {
    const id = app.pref.modelo;
    const { lp, res } = M.resolverModelo(id, app.estado);
    const cab = `${encabezado(id === 'curso' ? 'curso' : 'empresa', 'Paso 3 de 3', 'Análisis de sensibilidad',
      'Qué pasa con la solución óptima si cambia un dato, sin volver a resolver todo. Se trabaja sobre la tabla óptima con el procedimiento del curso.')}${selectorModelo()}`;
    if (res.estado !== 'optimo') return cab + mensajeEstado(res);
    const s = res.sensibilidad;
    const cols = res.cols;
    const max = res.maximizar;
    const nombreCol = (j) => cols[j].nombre;
    const abierto = id === 'curso' ? 'open' : '';

    const precios = `
      <section class="panel">
        <div class="panel-cab"><h2>a) Precio sombra ${info('precio-sombra')}</h2><p>¿Cuánto vale una unidad más de cada recurso?</p></div>
        <p class="panel-intro">Se lee en la fila Zj de la tabla óptima, en la columna de cada holgura, y se comprueba con B⁻¹ × (b + 1): se suma 1 al recurso, se recalcula la solución y se mide Z' − Z.</p>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Restricción</th><th class="n">bj</th><th class="n">Holgura</th><th class="n">Precio sombra</th><th>Qué significa</th><th class="n">Comprobación Z' − Z</th></tr></thead>
          <tbody>${lp.restricciones.map((r, i) => {
            const p = s.precios[i];
            return `<tr><td>${esc(r.nombre)}</td><td class="n">${f(r.rhs, 4)}</td><td class="n">${f(p.holgura, 4)}</td><td class="n">${f(p.y, 6)}</td><td>${p.y > 1e-9 ? `<span class="chip chip-crit">Limita</span> ${lecturaPrecio(lp, r, p.y)}` : '<span class="chip chip-ok">Sobra</span> una unidad más no cambia Z'}</td><td class="n">${p.factible ? f(p.zNuevo - res.z, 6) : 'fuera de rango'}</td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </section>`;

    const rangosB = `
      <section class="panel">
        <div class="panel-cab"><h2>b) Rango de los recursos (bj) ${info('rango')}</h2><p>¿Hasta dónde puede cambiar cada recurso sin cambiar la solución?</p></div>
        <p class="panel-intro">Se reemplaza bj por bj + d y se exige que la nueva solución B⁻¹ ${info('binv')} × b' no tenga valores negativos.</p>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Restricción</th><th class="n">bj actual</th><th class="n">Mínimo</th><th class="n">Máximo</th><th class="n">Intervalo de d</th></tr></thead>
          <tbody>${lp.restricciones.map((r, i) => { const x = s.rangosB[i]; return `<tr><td>${esc(r.nombre)}</td><td class="n">${f(r.rhs, 4)}</td><td class="n">${f(x.min, 4)}</td><td class="n">${f(x.max, 4)}</td><td class="n">${rangoTxt(x.dmin, x.dmax, 'd')}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <details class="plegable" style="margin-top:12px" ${abierto}><summary>Matriz B⁻¹ (columnas de las holguras iniciales en la tabla óptima)</summary><div class="contenido"><div class="tabla-simplex-env"><table class="simplex">
          <thead><tr><th class="cab">Base</th>${res.colInicial.map((c) => `<th class="cab">${esc(nombreCol(c))}</th>`).join('')}<th class="cab">bj</th></tr></thead>
          <tbody>${s.Binv.map((fila, k) => `<tr><td class="base">${esc(nombreCol(res.final.base[k]))}</td>${fila.map((v) => `<td>${fx(v)}</td>`).join('')}<td>${fx(res.final.b[k])}</td></tr>`).join('')}</tbody></table></div></div></details>
        ${lp.restricciones.map((r, i) => {
          const x = s.rangosB[i];
          return `<details class="plegable" style="margin-top:8px" ${abierto}><summary>Procedimiento · ${esc(r.nombre)}: b' = ${f(r.rhs, 4)} + d</summary><div class="contenido">
            <p class="small muted">Cada valor de la solución (columna bj) no puede ser negativo:</p>
            <div class="condiciones">${x.condiciones.map((cd) => cd.sentido === 'siempre'
              ? `<span>${fx(cd.b)} ≥ 0</span><span class="flecha">⟹</span><span>se cumple siempre (fila ${esc(nombreCol(res.final.base[cd.k]))})</span>`
              : `<span>${S.fmtLinealD(cd.b, cd.c, { fracciones: app.pref.fracciones })} ≥ 0</span><span class="flecha">⟹</span><span>d ${cd.sentido} ${fx(cd.lim)} (fila ${esc(nombreCol(res.final.base[cd.k]))})</span>`).join('')}</div>
            <p>Intervalo: <span class="rango">${rangoTxt(x.dmin, x.dmax, 'd')}</span> &nbsp;⟹&nbsp; <span class="rango">${rangoTxt(x.min, x.max, 'b')}</span>${x.invertida ? ' (fila invertida al normalizar)' : ''}</p>
          </div></details>`;
        }).join('')}
      </section>`;

    const rangosC = `
      <section class="panel">
        <div class="panel-cab"><h2>c) Rango de los coeficientes (Cj)</h2><p>¿Hasta dónde puede cambiar el aporte de cada variable sin cambiar la solución?</p></div>
        <p class="panel-intro">Se reemplaza Cj por Cj + d y se exige Cj − Zj ${max ? '≤' : '≥'} 0 en las columnas que no están en la base. Si la variable es básica, d también entra en la columna CB.</p>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Variable</th><th>Situación</th><th class="n">Cj actual</th><th class="n">Mínimo</th><th class="n">Máximo</th></tr></thead>
          <tbody>${s.rangosC.map((x) => `<tr><td class="mono">${esc(lp.variables[x.k].nombre)} <span class="muted small">${esc(lp.variables[x.k].etiqueta)}</span></td><td>${x.basica ? '<span class="chip chip-documentado">En la base</span>' : '<span class="chip chip-neutro">Fuera de la base</span>'}</td><td class="n">${f(lp.objetivo[x.k], 4)}</td><td class="n">${f(x.min, 4)}</td><td class="n">${f(x.max, 4)}</td></tr>`).join('')}</tbody>
        </table></div>
        ${s.rangosC.map((x) => {
          const v = lp.variables[x.k];
          const conds = x.basica
            ? x.condiciones.map((cd) => cd.sentido === 'siempre'
              ? `<span>Cj − Zj (${esc(nombreCol(cd.j))}) = ${fx(cd.d)}</span><span class="flecha">⟹</span><span>no depende de d</span>`
              : `<span>Cj − Zj (${esc(nombreCol(cd.j))}) = ${S.fmtLinealD(cd.d, -cd.t, { fracciones: app.pref.fracciones })} ${max ? '≤' : '≥'} 0</span><span class="flecha">⟹</span><span>d ${cd.sentido} ${fx(cd.lim)}</span>`).join('')
            : x.condiciones.map((cd) => `<span>Cj − Zj (${esc(v.nombre)}) = ${S.fmtLinealD(cd.d, 1, { fracciones: app.pref.fracciones })} ${max ? '≤' : '≥'} 0</span><span class="flecha">⟹</span><span>d ${cd.sentido} ${fx(cd.lim)}</span>`).join('');
          return `<details class="plegable" style="margin-top:8px" ${abierto}><summary>Procedimiento · ${esc(v.nombre)}: C = ${f(lp.objetivo[x.k], 4)} + d (${x.basica ? 'está en la base' : 'fuera de la base: solo cambia su Cj − Zj'})</summary><div class="contenido">
            <div class="condiciones">${conds || '<span>Sin columnas fuera de la base que comparar</span><span></span><span></span>'}</div>
            <p>Intervalo: <span class="rango">${rangoTxt(x.dmin, x.dmax, 'd')}</span> &nbsp;⟹&nbsp; <span class="rango">${rangoTxt(x.min, x.max, 'C')}</span></p>
          </div></details>`;
        }).join('')}
      </section>`;

    const dual = `
      <section class="panel">
        <div class="panel-cab"><h2>d) Comprobación con el dual ${info('dual')}</h2><p>El valor del dual debe ser igual a Z</p></div>
        <div class="formula">W = Σ bj · yj = ${lp.restricciones.map((r, i) => `${f(r.rhs, 4)}(${f(s.precios[i].y, 6)})`).join(' + ')} = ${f(s.w, 4)}</div>
        <p class="kpi-sub" style="margin-top:10px">${Math.abs(s.w - res.z) < 1e-6 ? `<span class="chip chip-ok">W = Z</span> Se cumple el teorema fuerte de la dualidad: ${f(s.w, 4)} = ${f(res.z, 4)}.` : '<span class="chip chip-warn">Revisar</span> W y Z difieren.'}</p>
      </section>`;

    return `${cab}
      <section class="panel"><div class="panel-cab"><h2>En pocas palabras</h2><p>Lectura de los resultados</p></div>${interpretacion(id, lp, res)}<div class="barra-herr" style="margin-top:14px"><button class="btn" type="button" data-accion="exportar">Descargar tablas y sensibilidad en Excel</button></div></section>
      ${precios}${rangosB}${rangosC}${dual}
      ${pasoNav(['tablas', 'Tablas Simplex'], ['diagnostico', 'Ver la aplicación en la planta'])}`;
  }

  /* ==========================================================================
     DIAGNÓSTICO DE PRODUCCIÓN (documentación de la empresa)
     ========================================================================== */
  function vistaDiagnostico() {
    const e = app.estado;
    const ind = M.indicadores(e);
    const c = ind.c;
    const pedido = c.pedido;
    const cumple = ind.capacidadActual >= pedido - 1e-6;
    const faltan = c.requeridosTotal - ind.N;
    const mejoraPct = ind.capacidadActual > 0 ? (ind.produccionOptima / ind.capacidadActual - 1) * 100 : null;
    const supuestos = e.estaciones.filter((s) => s.enTaller && s.opCalidad === 'supuesto').length;
    const lim = c.internas.find((x) => x.est.nombre === c.limite.nombre);
    const P = e.parametros;
    const nAuto = P.operariosDisponibles.calidad === 'supuesto';

    return `
      ${encabezado('empresa', 'Aplicación en la planta', 'Diagnóstico de producción',
        'Cuántas camisas puede hacer la planta con su personal, qué estación la frena y cómo mejorar. Usa los tiempos del DAP (36 actividades) y el estudio de tiempos del botonado.')}

      <section class="panel respuesta">
        <p class="respuesta-texto">Con el personal actual, la planta puede producir <b class="${cumple ? '' : 'crit'}" data-contar="${ind.capacidadActual}" data-dec="1">${f(ind.capacidadActual, 1)}</b> camisas por jornada. La frena <b>${esc(c.limite.nombre)}</b>${info('cuello')}${lim ? `, que necesita ${f(lim.requeridos, 2)} operarios para el pedido y tiene ${f(lim.n, 2)}` : ''}.</p>
        <div class="respuesta-chips">${cumple ? `<span class="chip chip-ok">Cubre el pedido de ${f(pedido, 0)}</span>` : `<span class="chip chip-crit">No cubre el pedido de ${f(pedido, 0)}</span>`}<span class="chip chip-neutro">Jornada de ${f(P.jornadaHoras.valor, 1)} h</span></div>
      </section>

      <section class="kpis" aria-label="Indicadores principales">
        <article class="kpi">
          <span class="kpi-etq">Producción posible hoy ${info('capacidad')}</span>
          <span class="kpi-valor"><span data-contar="${ind.capacidadActual}" data-dec="1">${f(ind.capacidadActual, 1)}</span><small>camisas/jornada</small></span>
          <span class="kpi-sub">Con el personal cargado en cada estación</span>
        </article>
        <article class="kpi">
          <span class="kpi-etq">Personal que exige el pedido ${info('operario-jornada')}</span>
          <span class="kpi-valor"><span data-contar="${c.requeridosTotal}" data-dec="1">${f(c.requeridosTotal, 1)}</span><small>operarios</small></span>
          <span class="kpi-sub">${faltan > 0.01 ? `<span class="chip chip-crit">Faltan ${f(faltan, 1)}</span>` : `<span class="chip chip-ok">Sobran ${f(-faltan, 1)}</span>`} Hay ${f(ind.N, 1)} disponibles</span>
        </article>
        <article class="kpi">
          <span class="kpi-etq">Con el mejor reparto ${info('reparto')}</span>
          <span class="kpi-valor"><span data-contar="${ind.produccionOptima}" data-dec="1">${f(ind.produccionOptima, 1)}</span><small>camisas/jornada</small></span>
          <span class="kpi-sub">${mejoraPct !== null && mejoraPct > 0.5 ? `<span class="chip chip-ok">+${f(mejoraPct, 0)} %</span> con las mismas personas` : 'El reparto actual ya es el mejor'}</span>
        </article>
      </section>

      <section class="panel">
        <div class="panel-cab"><h2>Personal por estación</h2><p>Ajusta los operarios aquí: todo se recalcula al instante</p></div>
        ${supuestos ? `<div class="aviso info" style="margin-bottom:14px"><div>Los informes de la empresa solo indican el personal de cuellos (2) y del botonado (1). En las otras ${supuestos} estaciones se cargó 1 operario como <b>dato supuesto</b> ${info('supuesto')}. Cambia los números con − y + según el personal real.</div></div>` : ''}
        <div class="supuestos" style="margin-bottom:14px">
          <label class="supuesto" for="d-pedido">Pedido <input class="campo" id="d-pedido" type="number" min="0" step="10" value="${P.pedido.valor}" data-bind="parametros.pedido.valor"> camisas</label>
          <label class="supuesto" for="d-jornada">Jornada <input class="campo" id="d-jornada" type="number" min="0" step="0.5" value="${P.jornadaHoras.valor}" data-bind="parametros.jornadaHoras.valor"> h</label>
          <label class="supuesto" for="d-n">Operarios disponibles <input class="campo" id="d-n" type="number" min="0" step="1" value="${f(ind.N, 2)}" data-bind="parametros.operariosDisponibles.valor"> ${nAuto ? '<span class="fuente">(suma del personal cargado)</span>' : ''}</label>
        </div>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Estación</th><th>Operarios</th><th class="carga-celda">Necesarios para el pedido</th><th class="n">Capacidad</th><th>Estado</th></tr></thead>
          <tbody>${e.estaciones.map((s, i) => {
            const cs = c.estaciones[i];
            if (!s.enTaller) return `<tr><td><b>${esc(s.nombre)}</b><br><span class="fuente">Se hace fuera del taller</span></td><td colspan="3" class="muted small">No limita la producción interna</td><td><span class="chip chip-neutro">Externa</span></td></tr>`;
            const esLim = c.limite.nombre === s.nombre;
            const falta = cs.n + 1e-6 < cs.requeridos;
            const maxV = Math.max(cs.requeridos, cs.n, 0.5) * 1.15;
            return `<tr class="${esLim ? 'fila-alerta' : ''}">
              <td><b>${esc(s.nombre)}</b><br><span class="fuente">${f(cs.t, 1)} s por camisa${s.opCalidad === 'supuesto' ? ' · personal supuesto' : ''}</span></td>
              <td><div class="paso-num"><button type="button" data-accion="op" data-i="${i}" data-delta="-1" aria-label="Quitar un operario en ${esc(s.nombre)}">−</button><input type="number" min="0" step="0.25" inputmode="decimal" aria-label="Operarios en ${esc(s.nombre)}" value="${s.operarios}" data-bind="estaciones.${i}.operarios"><button type="button" data-accion="op" data-i="${i}" data-delta="1" aria-label="Agregar un operario en ${esc(s.nombre)}">+</button></div></td>
              <td class="carga-celda"><div class="barra-fila" style="grid-template-columns:minmax(0,1fr) 46px;gap:8px"><span class="barra-pista"><span class="barra-relleno ${falta ? 'crit' : ''}" style="width:${Math.min(100, (cs.requeridos / maxV) * 100)}%"></span><span class="barra-marca" style="left:${Math.min(100, (cs.n / maxV) * 100)}%" title="Operarios actuales"></span></span><span class="barra-val num ${falta ? 'txt-crit' : ''}">${f(cs.requeridos, 2)}</span></div></td>
              <td class="n">${f(cs.cap, 1)}</td>
              <td>${esLim ? '<span class="chip chip-crit">Frena la planta</span>' : falta ? '<span class="chip chip-warn">Falta personal</span>' : '<span class="chip chip-ok">Alcanza</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <div class="leyenda-graf"><span><i style="background:var(--bar)"></i>Operarios necesarios para el pedido</span><span><i style="background:var(--crit)"></i>Falta personal</span><span><i style="background:var(--heading);border-radius:50%"></i>Operarios que hay</span><span>Capacidad = camisas por jornada</span></div>
      </section>

      <div class="rejilla rejilla-2">
        <section class="panel">
          <div class="panel-cab"><h2>Qué conviene hacer</h2><p>Ordenado por impacto</p></div>
          <ol class="lista-acciones">
            ${recomendaciones(ind).map((r, i) => `<li class="accion"><span class="accion-icono ${r.nivel}">${i + 1}</span><div><strong>${esc(r.titulo)}</strong><p>${r.texto}</p></div></li>`).join('')}
          </ol>
        </section>
        <section class="panel">
          <div class="panel-cab"><h2>Reparto sugerido del personal</h2><p>Calculado con el <button type="button" class="enlace" data-accion="ir-modelo" data-modelo="optimo">modelo Simplex "Mejor reparto del personal"</button></p></div>
          ${tablaPlan(ind)}
        </section>
      </div>

      <section class="panel">
        <div class="panel-cab"><h2>Dónde se pierde tiempo</h2><p>DAP del método actual, lote de 10 camisas</p></div>
        ${graficoDAP()}
      </section>`;
  }

  function siguienteLimite(c) {
    const todas = c.internas.map((e) => ({ nombre: e.est.nombre, cap: e.cap }))
      .concat(c.maquinas.map((m) => ({ nombre: m.maq.nombre, cap: m.cap })))
      .filter((x) => isFinite(x.cap)).sort((a, b) => a.cap - b.cap);
    return todas[1] ? todas[1].nombre : null;
  }

  function recomendaciones(ind) {
    const c = ind.c;
    const r = [];
    if (ind.horaExtra) {
      const sig = siguienteLimite(c);
      r.push({
        nivel: 'crit', titulo: `Refuerza ${ind.horaExtra.nombre.replace('Máquina: ', 'la ')}`,
        texto: `Es lo que frena la producción hoy (${f(c.limite.cap, 1)} camisas por jornada). Cada hora adicional ahí suma <b>${f(ind.horaExtra.camisasPorHora, 1)} camisas</b>${isFinite(ind.horaExtra.hastaHoras) && sig ? `, hasta unas ${f(ind.horaExtra.hastaHoras, 1)} h extra; después pasa a frenar ${esc(sig)}` : ''}.`,
      });
    }
    if (ind.produccionOptima > ind.capacidadActual + 0.5) {
      r.push({ nivel: 'ok', titulo: 'Reparte mejor al mismo personal', texto: `Con las mismas ${f(ind.N, 1)} personas, el reparto que calcula el Simplex produce <b>${f(ind.produccionOptima, 1)} camisas</b> por jornada en lugar de ${f(ind.capacidadActual, 1)}.` });
    }
    if (ind.produccionOptima < c.pedido - 0.5) {
      r.push({ nivel: 'warn', titulo: `Para llegar a ${f(c.pedido, 0)} camisas`, texto: `Faltan ${f(c.requeridosTotal - ind.N, 1)} operarios-jornada. Cada operario adicional suma <b>${f(ind.precioOperario, 1)} camisas</b>. Otra opción: extender la jornada a ${f(ind.jornadaNecesaria, 1)} h con el personal actual.` });
    } else {
      r.push({ nivel: 'ok', titulo: `El pedido de ${f(c.pedido, 0)} camisas se cumple`, texto: `Con el reparto óptimo sobran ${f(ind.N - c.requeridosTotal, 1)} operarios-jornada, que pueden reforzar inspección o cubrir ausencias.` });
    }
    const ligeras = c.internas.filter((e) => e.requeridos < 0.5).map((e) => e.est.nombre);
    if (ligeras.length >= 2) r.push({ nivel: 'info', titulo: 'Agrupa las estaciones con poca carga', texto: `${esc(lista(ligeras))} necesitan menos de medio operario cada una para el pedido: un operario polivalente puede cubrir varias.` });
    const bot = c.internas.find((e) => e.est.id === 'botonado');
    if (bot && !/boton/i.test(c.limite.nombre)) r.push({ nivel: 'info', titulo: 'Mejorar el botonado no sube la producción por sí solo', texto: `El botonado tiene holgura (hasta ${f(bot.cap, 0)} camisas por jornada). La guía física reduce el tiempo por camisa y la fatiga, pero la planta seguirá frenada por ${esc(c.limite.nombre)}.` });
    if (ind.dapTotal > 0) r.push({ nivel: 'warn', titulo: 'Reduce esperas y traslados', texto: `En el DAP, esperas y traslados suman ${f(ind.dapImprod, 1)} de ${f(ind.dapTotal, 1)} min por lote (${f((ind.dapImprod / ind.dapTotal) * 100, 1)} %) y ${f(ind.dapDist, 0)} m de recorrido. Acortarlos reduce el tiempo de entrega sin contratar personal.` });
    return r;
  }

  function tablaPlan(ind) {
    const plan = ind.plan;
    if (ind.optimo.res.estado !== 'optimo') return '<p class="muted">El modelo "Mejor reparto del personal" no tiene solución con estos datos.</p>';
    return `
      <div class="tabla-envoltura"><table class="datos">
        <thead><tr><th>Estación</th><th class="n">Simplex</th><th class="n">Fijos</th><th class="n">Polivalente</th></tr></thead>
        <tbody>${plan.filas.map((r) => `<tr><td>${esc(r.nombre)}</td><td class="n">${f(r.q, 2)}</td><td class="n">${r.fijos}</td><td class="n">${r.resto > 0.01 ? f(r.resto * 100, 0) + ' %' : '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${f(plan.filas.reduce((a, r) => a + r.q, 0), 2)}</td><td class="n">${plan.filas.reduce((a, r) => a + r.fijos, 0)}</td><td class="n">${plan.polivalentes.length} pers.</td></tr></tfoot>
      </table></div>
      ${plan.polivalentes.length ? `<div class="polivalentes" style="margin-top:12px">${plan.polivalentes.map((p, i) => `
        <div class="poli"><strong>Polivalente ${i + 1} · ${f(p.carga * 100, 0)} % de su jornada</strong>
        ${p.partes.map((x) => `${esc(x.nombre)} <span class="num muted">${f(x.fraccion * 100, 0)} %</span>`).join(' · ')}
        <div class="barra-carga"><span style="width:${Math.min(100, p.carga * 100)}%"></span></div></div>`).join('')}</div>` : ''}
      <p class="fuente" style="margin-top:10px">"Fijos" trabajan toda la jornada en una estación. Un polivalente reparte su jornada entre varias: confirma que domine esas operaciones.</p>`;
  }

  function graficoCapacidad(c) {
    const filas = c.internas.map((e) => ({ nombre: e.est.nombre, cap: e.cap }))
      .concat(c.maquinas.map((m) => ({ nombre: 'Máq. ' + m.maq.nombre, cap: m.cap })))
      .filter((x) => isFinite(x.cap));
    if (!filas.length) return '';
    const minCap = Math.min(...filas.map((x) => x.cap));
    const maxDom = Math.max(c.pedido * 1.4, Math.min(Math.max(...filas.map((x) => x.cap)), c.pedido * 3)) || 1;
    const pct = (v) => Math.min(100, (v / maxDom) * 100);
    return `<div class="barras" role="list" aria-label="Capacidad por estación frente al pedido">
      ${filas.map((r) => {
        const esMin = Math.abs(r.cap - minCap) < 1e-6;
        return `<div class="barra-fila" role="listitem">
          <span class="barra-etq">${esc(r.nombre)}</span>
          <span class="barra-pista"><span class="barra-relleno ${esMin ? 'crit' : ''}" style="width:${pct(r.cap)}%"></span><span class="barra-ref" style="left:${pct(c.pedido)}%"></span></span>
          <span class="barra-val num ${esMin ? 'txt-crit' : ''}">${r.cap > maxDom ? '› ' : ''}${f(r.cap, 0)}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="leyenda-graf"><span><i style="background:var(--crit)"></i>Estación que frena</span><span><i style="background:transparent;border-left:2px dashed var(--crit);border-radius:0"></i>Pedido de ${f(c.pedido, 0)} camisas</span></div>`;
  }

  function graficoDAP() {
    const dap = app.estado.dap;
    const tipos = ['op', 'in', 'es', 'tr'];
    const nombres = { op: 'Operaciones', in: 'Inspecciones', es: 'Esperas', tr: 'Traslados' };
    const colores = { op: 'var(--bar)', in: 'var(--bar-2)', es: 'var(--crit)', tr: 'var(--warn)' };
    const tot = {}; let total = 0;
    tipos.forEach((t) => { tot[t] = dap.filter((d) => d.tipo === t).reduce((a, d) => a + (Number(d.min) || 0), 0); total += tot[t]; });
    const cuenta = (t) => dap.filter((d) => d.tipo === t).length;
    const dist = dap.reduce((a, d) => a + (Number(d.dist) || 0), 0);
    return `
      <div style="display:flex;height:26px;border-radius:6px;overflow:hidden" role="img" aria-label="Distribución del tiempo del DAP">${tipos.map((t) => `<span class="barra-relleno" style="position:static;display:block;border-radius:0;width:${total ? (tot[t] / total) * 100 : 0}%;background:${colores[t]}"></span>`).join('')}</div>
      <div class="rejilla rejilla-2" style="margin-top:14px;align-items:start">
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Tipo</th><th class="n">Actividades</th><th class="n">Minutos</th><th class="n">% del lote</th></tr></thead>
          <tbody>${tipos.map((t) => `<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colores[t]};margin-right:8px"></i>${nombres[t]}</td><td class="n">${cuenta(t)}</td><td class="n">${f(tot[t], 1)}</td><td class="n">${f(total ? (tot[t] / total) * 100 : 0, 1)} %</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total del lote</td><td class="n">${dap.length}</td><td class="n">${f(total, 1)}</td><td class="n">100 %</td></tr></tfoot>
        </table></div>
        <div class="enunciado">
          <p>Para hacer un lote de 10 camisas pasan <b>${f(total, 1)} minutos</b> y el material recorre <b>${f(dist, 0)} m</b>.</p>
          <p>Las esperas y los traslados no agregan valor y suman <b>${f(((tot.es + tot.tr) / (total || 1)) * 100, 1)} %</b> del tiempo: reducirlos acorta la entrega sin contratar personal.</p>
          <p class="fuente">${esc(FUENTES.pdfDap)}</p>
        </div>
      </div>`;
  }

  /* ==========================================================================
     SIMULADOR
     ========================================================================== */
  function escenarioBase() {
    const P = app.estado.parametros;
    const cuerpo = app.estado.estaciones.find((e) => e.id === 'cuerpo');
    const B = app.estado.estudioTiempos.elementos.find((e) => e.id === 'B');
    return {
      jornada: P.jornadaHoras.valor, pedido: P.pedido.valor, operarios: M.operariosDisponibles(app.estado),
      disponibilidad: P.disponibilidad.valor,
      metodo: B && Math.abs(B.observado - DATOS_ORIGINALES.presetsTiempos.propuesto.B) < 1e-6 ? 'propuesto' : 'actual',
      cuerpoExterno: cuerpo ? !cuerpo.enTaller : false,
    };
  }

  function estadoEscenario() {
    const e = clonar(app.estado), x = app.esc;
    e.parametros.jornadaHoras.valor = x.jornada;
    e.parametros.pedido.valor = x.pedido;
    e.parametros.operariosDisponibles.valor = x.operarios;
    e.parametros.operariosDisponibles.calidad = 'ingresado';
    e.parametros.disponibilidad.valor = x.disponibilidad;
    const preset = DATOS_ORIGINALES.presetsTiempos[x.metodo];
    ['A', 'B', 'C'].forEach((id) => { const el = e.estudioTiempos.elementos.find((k) => k.id === id); if (el) el.observado = preset[id]; });
    const cuerpo = e.estaciones.find((k) => k.id === 'cuerpo');
    if (cuerpo) cuerpo.enTaller = !x.cuerpoExterno;
    return e;
  }

  function vistaSimulador() {
    if (!app.esc) app.esc = escenarioBase();
    const x = app.esc;
    const control = (id, etq, min, max, paso, valor, sufijo, ayudaTxt) => `
      <div class="control">
        <div class="control-cab"><label for="esc-${id}">${etq}</label><output id="out-${id}" for="esc-${id}">${f(valor, 2)} ${sufijo}</output></div>
        <input type="range" id="esc-${id}" data-esc="${id}" data-sufijo="${sufijo}" min="${min}" max="${max}" step="${paso}" value="${valor}">
        ${ayudaTxt ? `<span class="fuente">${ayudaTxt}</span>` : ''}
      </div>`;
    return `
      ${encabezado('empresa', 'Aplicación en la planta', 'Simulador: ¿qué pasa si…?', 'Mueve un control y mira cómo cambian los resultados frente a la situación actual. Nada se guarda hasta que pulses "Aplicar a los datos".')}
      <div class="rejilla rejilla-lado">
        <section class="panel" aria-label="Controles del escenario">
          <div class="panel-cab"><h2>Cambia un dato</h2></div>
          ${control('jornada', 'Horas de la jornada', 6, 12, 0.5, x.jornada, 'h', 'El Word indica jornadas de 8 a 10 horas')}
          ${control('pedido', 'Camisas pedidas por jornada', 50, 500, 10, x.pedido, 'camisas', 'Referencia de la empresa: 200')}
          ${control('operarios', 'Personas disponibles', 4, 30, 1, x.operarios, 'pers.', 'Para repartir entre las estaciones')}
          ${control('disponibilidad', 'Disponibilidad de las máquinas', 70, 100, 0.25, x.disponibilidad, '%', 'Tiempo sin paradas por mantenimiento o atascos (Word: 93.75 %)')}
          <div class="control">
            <div class="control-cab"><label for="esc-metodo">Método de botonado</label></div>
            <select class="campo" id="esc-metodo" data-esc="metodo" style="text-align:left">
              <option value="actual" ${x.metodo === 'actual' ? 'selected' : ''}>Actual (ciclo de 37.48 s)</option>
              <option value="propuesto" ${x.metodo === 'propuesto' ? 'selected' : ''}>Con guía física (ciclo de 35.61 s)</option>
            </select>
            <span class="fuente">Propuesta del estudio de métodos</span>
          </div>
          <div class="control">
            <label class="campo-fila" for="esc-cuerpo"><input type="checkbox" id="esc-cuerpo" data-esc="cuerpoExterno" ${x.cuerpoExterno ? 'checked' : ''}> La confección del cuerpo se hace fuera</label>
            <span class="fuente">El PDF menciona que el cuerpo se envía a sucursales externas</span>
          </div>
          <div class="pie-acciones" style="margin-top:12px">
            <button class="btn" type="button" data-accion="esc-restablecer">Volver a la situación actual</button>
            <button class="btn btn-primario" type="button" data-accion="esc-aplicar">Aplicar a los datos</button>
          </div>
        </section>
        <section id="esc-resultados" style="display:flex;flex-direction:column;gap:18px;min-width:0">${resultadosEscenario()}</section>
      </div>`;
  }

  function resultadosEscenario() {
    const b = M.indicadores(app.estado);
    const ee = estadoEscenario();
    const e = M.indicadores(ee);
    const teB = M.tiempoEstandarBotonado(app.estado.estudioTiempos).total;
    const teE = M.tiempoEstandarBotonado(ee.estudioTiempos).total;
    const filas = [
      ['Producción posible con el personal actual', b.capacidadActual, e.capacidadActual, 'camisas', 1],
      ['Estación que frena', b.c.limite.nombre, e.c.limite.nombre, '', 0],
      ['Producción con el mejor reparto', b.produccionOptima, e.produccionOptima, 'camisas', 1],
      ['Personal que exige el pedido', b.c.requeridosTotal, e.c.requeridosTotal, 'operarios', -1],
      ['Camisas que suma un operario más', b.precioOperario, e.precioOperario, 'camisas', 0],
      ['Camisas que suma una hora extra donde se frena', b.horaExtra ? b.horaExtra.camisasPorHora : 0, e.horaExtra ? e.horaExtra.camisasPorHora : 0, 'camisas', 0],
      ['Jornada necesaria con las personas disponibles', b.jornadaNecesaria, e.jornadaNecesaria, 'h', -1],
      ['Tiempo estándar del botonado', teB, teE, 's', -1],
    ];
    const celdaDelta = (a, z, sentido) => {
      if (typeof a !== 'number' || !isFinite(a) || !isFinite(z)) return '<td class="n">—</td>';
      const d = z - a;
      if (Math.abs(d) < 0.005) return '<td class="n muted">sin cambio</td>';
      const mejor = sentido === 0 ? null : (sentido > 0 ? d > 0 : d < 0);
      const cls = mejor === null ? '' : (mejor ? 'delta-sube' : 'delta-baja');
      return `<td class="n ${cls}">${d > 0 ? '▲ +' : '▼ −'}${f(Math.abs(d), 2)}</td>`;
    };
    const frase = e.produccionOptima >= e.c.pedido - 0.5
      ? `En este escenario <b>el pedido de ${f(e.c.pedido, 0)} camisas se cumple</b> con el mejor reparto y sobran ${f(e.N - e.c.requeridosTotal, 1)} operarios-jornada.`
      : `En este escenario el mejor reparto llega a ${f(e.produccionOptima, 1)} camisas: <b>faltan ${f(e.c.requeridosTotal - e.N, 1)} operarios-jornada</b> para el pedido de ${f(e.c.pedido, 0)}.`;
    return `
      <div class="panel">
        <div class="panel-cab"><h2>Resultado del escenario</h2><p>Comparado con la situación actual</p></div>
        <p class="panel-intro" style="margin-top:-4px">${frase}</p>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Indicador</th><th class="n">Hoy</th><th class="n">Escenario</th><th class="n">Cambio</th></tr></thead>
          <tbody>${filas.map(([n, a, z, u, s]) => `<tr><td>${esc(n)}${u ? ` <span class="muted small">(${u})</span>` : ''}</td>
            <td class="n">${typeof a === 'number' ? f(a, 2) : esc(a)}</td><td class="n">${typeof z === 'number' ? f(z, 2) : esc(z)}</td>
            ${typeof a === 'number' ? celdaDelta(a, z, s) : `<td class="n ${a !== z ? 'delta-baja' : 'muted'}">${a !== z ? 'cambia' : 'igual'}</td>`}</tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="panel">
        <div class="panel-cab"><h2>Capacidad de cada estación en el escenario</h2><p>Camisas por jornada con el personal actual</p></div>
        ${graficoCapacidad(e.c)}
      </div>`;
  }

  /* ==========================================================================
     DATOS DE LA EMPRESA
     ========================================================================== */
  function vistaDatos() {
    const e = app.estado;
    const c = M.capacidades(e);
    const P = e.parametros;
    const valorParam = (clave) => (clave === 'operariosDisponibles' ? M.operariosDisponibles(e) : P[clave].valor);
    const campoParam = (clave, etq, paso, unidad) => `
      <div class="campo-grupo">
        <label for="p-${clave}">${etq}</label>
        <div class="campo-fila"><input class="campo" id="p-${clave}" type="number" min="0" step="${paso}" inputmode="decimal" value="${valorParam(clave)}" data-bind="parametros.${clave}.valor"><span class="muted small">${unidad}</span></div>
        <div class="campo-fila" style="align-items:flex-start">${chip(P[clave].calidad)}<span class="fuente">${esc(P[clave].fuente)}</span></div>
      </div>`;
    const dapEstacion = (n) => { const st = e.estaciones.find((s) => s.actividades.includes(n)); return st ? st.nombre : ''; };

    return `
      ${encabezado('empresa', 'Aplicación en la planta', 'Datos de la empresa',
        'Todo lo que usa el planificador, tomado de los informes de Ingeniería de Procesos (Word) y de Ingeniería de Métodos (PDF). Puedes corregir cualquier valor: los resultados se recalculan y los cambios se guardan en este navegador.')}
      <div class="leyenda-chips">${chip('documentado')} Tomado de los informes ${chip('simulado')} El informe aclara que es simulado ${chip('supuesto')} No figura: reemplázalo ${chip('ingresado')} Lo ingresaste tú</div>
      <div class="barra-herr">
        <button class="btn" type="button" data-accion="exportar">Descargar en Excel (.xlsx)</button>
        <button class="btn" type="button" data-accion="importar">Cargar datos desde Excel</button>
        <button class="btn" type="button" data-accion="restaurar">Volver a los datos de los informes</button>
      </div>

      <section class="panel">
        <div class="panel-cab"><h2>Jornada y pedido</h2></div>
        <div class="rejilla" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
          ${campoParam('jornadaHoras', 'Jornada de trabajo', 0.5, 'horas')}
          ${campoParam('pedido', 'Pedido por jornada', 1, 'camisas')}
          ${campoParam('operariosDisponibles', 'Operarios disponibles', 1, 'personas')}
          ${campoParam('disponibilidad', 'Disponibilidad de máquinas', 0.25, '%')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-cab"><h2>Estaciones de trabajo</h2><p>Agrupan las operaciones del DAP; el tiempo por camisa sale de sus minutos (lote de ${e.loteDAP} camisas)</p></div>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Estación</th><th>Actividades del DAP</th><th class="n">Min por lote</th><th class="n">s por camisa</th><th class="n">Capacidad</th><th>Operarios</th><th>En taller</th><th>Dato de operarios</th></tr></thead>
          <tbody>${e.estaciones.map((s, i) => {
            const cs = c.estaciones[i];
            return `<tr class="${s.enTaller && c.limite.nombre === s.nombre ? 'fila-alerta' : ''}">
              <td><b>${esc(s.nombre)}</b>${s.usaTE ? `<br><span class="fuente">Usa el <a href="#tiempo">tiempo estándar</a></span>` : ''}</td>
              <td class="mono small">${s.actividades.join(', ')}</td>
              <td class="n">${f(cs.minutos, 1)}</td>
              <td class="n">${f(cs.t, 2)}</td>
              <td class="n">${s.enTaller ? f(cs.cap, 1) : '—'}</td>
              <td><input class="campo" type="number" min="0" step="0.25" inputmode="decimal" aria-label="Operarios en ${esc(s.nombre)}" value="${s.operarios}" data-bind="estaciones.${i}.operarios"></td>
              <td style="text-align:center"><input type="checkbox" aria-label="${esc(s.nombre)} en el taller" ${s.enTaller ? 'checked' : ''} data-bind="estaciones.${i}.enTaller"></td>
              <td><span title="${esc(s.opFuente)}">${chip(s.opCalidad)}</span></td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr><td colspan="3">Total en el taller</td><td class="n">${f(c.sumaT, 2)}</td><td></td><td class="n">${f(c.internas.reduce((a, x) => a + x.n, 0), 2)}</td><td colspan="2"></td></tr></tfoot>
        </table></div>
        <p class="fuente" style="margin-top:8px">Capacidad = operarios × segundos de la jornada ÷ segundos por camisa. La fila resaltada es la estación que frena la planta.</p>
      </section>

      <section class="panel">
        <div class="panel-cab"><h2>Máquinas únicas</h2><p>Su tiempo se reduce por la disponibilidad (${f(P.disponibilidad.valor, 2)} %)</p></div>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Máquina</th><th>Cantidad</th><th class="n">s por camisa</th><th class="n">Capacidad</th><th>Fuente</th></tr></thead>
          <tbody>${e.maquinas.map((m, i) => `<tr>
            <td><b>${esc(m.nombre)}</b></td>
            <td><input class="campo" type="number" min="0" step="1" aria-label="Cantidad de ${esc(m.nombre)}" value="${m.cantidad}" data-bind="maquinas.${i}.cantidad"></td>
            <td class="n">${m.vinculo ? f(c.maquinas[i].t, 2) : `<input class="campo" type="number" min="0" step="0.1" aria-label="Segundos por camisa en ${esc(m.nombre)}" value="${m.segundos}" data-bind="maquinas.${i}.segundos">`}</td>
            <td class="n">${f(c.maquinas[i].cap, 1)}</td>
            <td>${chip(m.calidad)} <span class="fuente">${esc(m.fuente)}</span></td></tr>`).join('')}</tbody>
        </table></div>
      </section>

      <details class="plegable">
        <summary>DAP del método actual · 36 actividades, lote de 10 camisas</summary>
        <div class="contenido">
          <p class="fuente">${esc(FUENTES.pdfDap)}. Cambia un tiempo y se recalculan las estaciones.</p>
          <div class="tabla-envoltura"><table class="datos">
            <thead><tr><th class="n">N°</th><th>Actividad</th><th>Tipo</th><th>Cantidad</th><th class="n">Distancia (m)</th><th>Tiempo (min)</th><th>Estación</th></tr></thead>
            <tbody>${e.dap.map((d, i) => `<tr>
              <td class="n">${d.n}</td><td>${esc(d.actividad)}</td><td><span class="chip ${d.tipo === 'op' ? 'chip-documentado' : d.tipo === 'in' || d.tipo === 'al' ? 'chip-neutro' : 'chip-warn'}">${ETIQUETAS_TIPO_DAP[d.tipo]}</span></td>
              <td class="small">${esc(d.cantidad)}</td><td class="n">${d.dist ? f(d.dist, 0) : ''}</td>
              <td>${d.tipo === 'al' ? '' : `<input class="campo" type="number" min="0" step="0.1" aria-label="Minutos de ${esc(d.actividad)}" value="${d.min}" data-bind="dap.${i}.min">`}</td>
              <td class="small">${esc(dapEstacion(d.n))}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td></td><td colspan="3">Total</td><td class="n">${f(e.dap.reduce((a, d) => a + (Number(d.dist) || 0), 0), 0)}</td><td class="n">${f(e.dap.reduce((a, d) => a + (Number(d.min) || 0), 0), 1)}</td><td></td></tr></tfoot>
          </table></div>
        </div>
      </details>

      <section class="panel">
        <div class="panel-cab"><h2>Diferencias entre los documentos</h2><p>Lo que conviene validar en planta</p></div>
        <ul class="lista-acciones">
          ${ALERTAS_DATOS.map((a) => `<li class="accion"><span class="accion-icono ${a.nivel === 'warn' ? 'warn' : 'info'}">${a.nivel === 'warn' ? '!' : 'i'}</span><div><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></div></li>`).join('')}
        </ul>
      </section>`;
  }

  /* ==========================================================================
     TIEMPO ESTÁNDAR
     ========================================================================== */
  function vistaTiempo() {
    const e = app.estado;
    const et = e.estudioTiempos;
    const te = M.tiempoEstandarBotonado(et);
    const T = M.jornadaSeg(e);
    const idxBot = e.estaciones.findIndex((s) => s.id === 'botonado');
    const bot = e.estaciones[idxBot];
    const c = M.capacidades(e);
    const capBot = c.estaciones[idxBot];
    const frena = /boton/i.test(c.limite.nombre);
    return `
      ${encabezado('empresa', 'Aplicación en la planta', 'Tiempo estándar del botonado',
        `Así se obtiene el <b>43.08 s por camisa</b> que usa el modelo por tallas en la restricción de ojales y botones. Los datos vienen del estudio de tiempos del informe de Métodos.`)}
      <div class="kpis">
        <article class="kpi"><span class="kpi-etq">Tiempo estándar ${info('tiempo-estandar')}</span><span class="kpi-valor"><span data-contar="${te.total}" data-dec="2">${f(te.total, 4)}</span><small>s por camisa</small></span><span class="kpi-sub">${chip(et.calidad)} ${esc(et.fuente)}</span></article>
        <article class="kpi"><span class="kpi-etq">Camisas por hora</span><span class="kpi-valor">${f(3600 / te.total, 2)}<small>camisas</small></span><span class="kpi-sub">3600 s ÷ tiempo estándar</span></article>
        <article class="kpi"><span class="kpi-etq">Camisas por jornada</span><span class="kpi-valor">${f(T / te.total, 2)}<small>camisas</small></span><span class="kpi-sub">${f(T, 0)} s ÷ ${f(te.total, 4)} s, con una operaria</span></article>
      </div>

      <section class="panel">
        <div class="panel-cab"><h2>Elementos del ciclo de botonado</h2>
          <div class="segmentos" role="group" aria-label="Método">
            <button type="button" data-accion="preset" data-preset="actual">Cargar método actual</button>
            <button type="button" data-accion="preset" data-preset="propuesto">Cargar método con guía física</button>
          </div>
        </div>
        <div class="tabla-envoltura"><table class="datos">
          <thead><tr><th>Elemento</th><th>Tiempo observado (s)</th><th>Valoración (%)</th><th>Ocurre cada</th><th class="n">Tiempo normal (s)</th><th class="n">Estándar por camisa (s)</th></tr></thead>
          <tbody>${te.detalle.map((x, i) => `<tr>
            <td><b>${x.id}</b> · ${esc(x.nombre)}</td>
            <td><input class="campo" type="number" min="0" step="0.0001" aria-label="Tiempo observado ${x.id}" value="${x.observado}" data-bind="estudioTiempos.elementos.${i}.observado"></td>
            <td><input class="campo" type="number" min="0" step="0.0001" aria-label="Valoración ${x.id}" value="${x.valoracion}" data-bind="estudioTiempos.elementos.${i}.valoracion"></td>
            <td><div class="campo-fila"><input class="campo" type="number" min="1" step="1" aria-label="Frecuencia ${x.id}" value="${x.cadaN}" data-bind="estudioTiempos.elementos.${i}.cadaN"><span class="muted small">camisa(s)</span></div></td>
            <td class="n">${f(x.normal, 4)}</td><td class="n">${f(x.porCamisa, 4)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Tiempo estándar total</td><td class="n">${f(te.total, 4)}</td></tr></tfoot>
        </table></div>
        <div class="campo-fila" style="margin-top:14px;flex-wrap:wrap">
          <label for="sup">Suplementos</label>
          <input class="campo" id="sup" type="number" min="0" step="0.5" value="${et.suplemento}" data-bind="estudioTiempos.suplemento" style="max-width:110px"><span class="muted small">% (5 % necesidades personales + 4 % fatiga básica)</span>
        </div>
        <div class="formula" style="margin-top:14px">Tiempo normal = Tiempo observado × Valoración ÷ 100<br>Tiempo estándar = Tiempo normal × (1 + ${f(et.suplemento, 2)} %) ÷ frecuencia<br>TE = ${te.detalle.map((x) => f(x.porCamisa, 4)).join(' + ')} = ${f(te.total, 4)} s por camisa</div>
      </section>

      <section class="panel">
        <div class="panel-cab"><h2>Efecto en la planta</h2></div>
        <label class="campo-fila" for="usa-te"><input type="checkbox" id="usa-te" ${bot && bot.usaTE ? 'checked' : ''} data-bind="estaciones.${idxBot}.usaTE"> Usar este tiempo estándar en la estación de botonado (si no, se usa el tiempo del DAP: ${f(((e.dap.find((d) => d.n === 27) || {}).min || 0) * 6, 1)} s)</label>
        <p class="kpi-sub" style="margin-top:12px">${frena
          ? 'El botonado es hoy lo que frena la planta: bajar este tiempo aumenta la producción.'
          : `El botonado puede hacer hasta <b>${f(capBot ? capBot.cap : 0, 1)} camisas</b> por jornada y la planta está frenada por <b>${esc(c.limite.nombre)}</b> (${f(c.limite.cap, 1)}). Mejorar el botonado ahorra tiempo de la operaria, pero no sube la producción de la planta.`}</p>
      </section>`;
  }

  /* ==========================================================================
     GUÍA
     ========================================================================== */
  function vistaGuia() {
    return `
      ${encabezado('', 'Ayuda', 'Guía de uso y glosario', 'Cómo recorrer el planificador, qué significa cada término y de dónde sale cada dato.')}
      <div class="rejilla rejilla-2">
        <section class="panel">
          <div class="panel-cab"><h2>Para revisar la resolución con la metodología del curso</h2></div>
          <ol class="pasos">
            <li><div><strong>Planteamiento del modelo</strong><p>Qué decide el modelo, sus datos, la forma canónica y la forma estándar con sus holguras.</p></div></li>
            <li><div><strong>Tablas Simplex paso a paso</strong><p>Cada tabla Cj − Zj con la variable que entra, la que sale, la razón de cambio y las operaciones de fila.</p></div></li>
            <li><div><strong>Análisis de sensibilidad</strong><p>Precios sombra, rangos de los recursos con B⁻¹, rangos de los coeficientes con Cj + d y comprobación con el dual.</p></div></li>
          </ol>
        </section>
        <section class="panel">
          <div class="panel-cab"><h2>Para usarlo en la empresa</h2></div>
          <ol class="pasos">
            <li><div><strong>Diagnóstico de producción</strong><p>Ajusta el personal de cada estación y mira cuánto se produce, qué la frena y qué conviene hacer.</p></div></li>
            <li><div><strong>Simulador</strong><p>Prueba otra jornada, otro pedido, más personas o el método de botonado con guía física.</p></div></li>
            <li><div><strong>Datos de la empresa</strong><p>Revisa y corrige los datos de los informes. Cada número muestra su fuente.</p></div></li>
          </ol>
        </section>
      </div>
      <section class="panel">
        <div class="panel-cab"><h2>Glosario</h2><p>También aparece al pulsar los botones "?" en cada pantalla</p></div>
        <dl class="glosario">${Object.values(GLOSARIO).map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
      </section>
      <section class="panel">
        <div class="panel-cab"><h2>De dónde salen los datos</h2></div>
        <div class="tabla-envoltura"><table class="datos"><thead><tr><th>Dato</th><th>Valor</th><th>Fuente</th></tr></thead><tbody>
          <tr><td>Tiempos por actividad</td><td class="mono">36 actividades · 386.3 min por lote</td><td class="small">${esc(FUENTES.pdfDap)}</td></tr>
          <tr><td>Tiempo estándar del botonado</td><td class="mono">43.0836 s por camisa</td><td class="small">${esc(FUENTES.pdfTE)}</td></tr>
          <tr><td>Método propuesto (guía física)</td><td class="mono">ciclo 37.48 → 35.61 s</td><td class="small">${esc(FUENTES.pdfMetodo)}</td></tr>
          <tr><td>Jornada</td><td class="mono">8 h = 28 800 s</td><td class="small">${esc(FUENTES.wordJornada)}</td></tr>
          <tr><td>Pedido de referencia</td><td class="mono">200 camisas por jornada</td><td class="small">${esc(FUENTES.wordProduccion)}</td></tr>
          <tr><td>Operarios en cuellos</td><td class="mono">2</td><td class="small">${esc(FUENTES.wordCuellos)}</td></tr>
          <tr><td>Disponibilidad de máquinas</td><td class="mono">93.75 %</td><td class="small">${esc(FUENTES.wordDisp)}</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel">
        <div class="panel-cab"><h2>Cómo funciona por dentro</h2></div>
        <p class="kpi-sub">Sitio estático en HTML, CSS y JavaScript, sin servidor ni base de datos. El motor Simplex (<span class="mono">js/simplex.js</span>) usa la variante Cj − Zj con M grande simbólica y cambia a la regla de Bland si detecta ciclaje. Los modelos (<span class="mono">js/modelos.js</span>) se arman con los datos de <span class="mono">js/datos.js</span>. Lo que edites se guarda en este navegador; con "Descargar en Excel" lo llevas a otra computadora o lo revisas en Excel.</p>
        <p class="fuente" style="margin-top:10px">Autoría: Jaren Jeison Alfaro Porras · Investigación Operativa I · 2026-II</p>
      </section>`;
  }

  /* ==========================================================================
     EVENTOS
     ========================================================================== */
  function asignar(obj, ruta, valor) {
    const partes = ruta.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) o = o[/^\d+$/.test(partes[i]) ? Number(partes[i]) : partes[i]];
    const ult = partes[partes.length - 1];
    o[/^\d+$/.test(ult) ? Number(ult) : ult] = valor;
  }

  function marcarIngresado(ruta) {
    let m = ruta.match(/^estaciones\.(\d+)\.operarios$/);
    if (m) { const s = app.estado.estaciones[Number(m[1])]; s.opCalidad = 'ingresado'; s.opFuente = 'Dato ingresado en el planificador'; return; }
    m = ruta.match(/^parametros\.(\w+)\.valor$/);
    if (m) { const p = app.estado.parametros[m[1]]; p.calidad = 'ingresado'; p.fuente = 'Dato ingresado en el planificador'; return; }
    m = ruta.match(/^maquinas\.(\d+)\./);
    if (m) { const q = app.estado.maquinas[Number(m[1])]; q.calidad = 'ingresado'; q.fuente = 'Dato ingresado en el planificador'; }
  }

  function rerender() {
    const y = window.scrollY;
    const activo = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.bind : null;
    render(false);
    window.scrollTo(0, y);
    if (activo) { const el = document.querySelector(`[data-bind="${activo}"]`); if (el && el.focus) el.focus({ preventScroll: true }); }
  }

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'archivo-importar') { importar(el.files && el.files[0]); el.value = ''; return; }
    if (el.dataset.pref === 'fracciones') { app.pref.fracciones = el.checked; guardarPref(); rerender(); return; }
    if (el.dataset.esc) { leerControlEscenario(el); return; }
    const ruta = el.dataset.bind;
    if (!ruta) return;
    let valor;
    if (el.type === 'checkbox') valor = el.checked;
    else {
      valor = parseFloat(String(el.value).replace(',', '.'));
      if (!isFinite(valor) || valor < 0) { toast('Ingresa un número mayor o igual a 0'); rerender(); return; }
      if (/cadaN$/.test(ruta) && valor < 1) { toast('La frecuencia debe ser al menos 1'); rerender(); return; }
    }
    asignar(app.estado, ruta, valor);
    if (el.type !== 'checkbox') marcarIngresado(ruta);
    app.esc = null;
    guardar();
    rerender();
  });

  function leerControlEscenario(el) {
    const k = el.dataset.esc;
    if (el.type === 'checkbox') app.esc[k] = el.checked;
    else if (el.tagName === 'SELECT') app.esc[k] = el.value;
    else {
      app.esc[k] = Number(el.value);
      const out = document.getElementById('out-' + k);
      if (out) out.textContent = `${f(app.esc[k], 2)} ${el.dataset.sufijo || ''}`;
    }
    const cont = document.getElementById('esc-resultados');
    if (cont) cont.innerHTML = resultadosEscenario();
  }
  document.addEventListener('input', (ev) => { if (ev.target.dataset && ev.target.dataset.esc && ev.target.type === 'range') leerControlEscenario(ev.target); });

  document.addEventListener('click', (ev) => {
    const tip = ev.target.closest('.tip');
    if (tip) { ev.preventDefault(); ev.stopPropagation(); if (popover && popover._btn === tip) cerrarTip(); else mostrarTip(tip); return; }
    if (popover && !ev.target.closest('.popover')) cerrarTip();
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const accion = b.dataset.accion;
    ev.preventDefault();
    switch (accion) {
      case 'modelo': app.pref.modelo = b.dataset.modelo; app.pref.iter = 0; guardarPref(); render(true); break;
      case 'ir-modelo': app.pref.modelo = b.dataset.modelo; app.pref.iter = 0; guardarPref(); location.hash = '#planteamiento'; break;
      case 'vista': app.pref.vista = b.dataset.vista; app.pref.iter = 0; guardarPref(); rerender(); break;
      case 'iter': app.pref.iter = (app.pref.iter || 0) + Number(b.dataset.delta); guardarPref(); rerender(); break;
      case 'op': {
        const s = app.estado.estaciones[Number(b.dataset.i)];
        s.operarios = Math.max(0, Math.round(((Number(s.operarios) || 0) + Number(b.dataset.delta)) * 100) / 100);
        s.opCalidad = 'ingresado'; s.opFuente = 'Dato ingresado en el planificador';
        app.esc = null; guardar(); rerender();
        break;
      }
      case 'tema': cambiarTema(); break;
      case 'exportar': exportar(b); break;
      case 'importar': $('#archivo-importar').click(); break;
      case 'restaurar':
        if (b.dataset.confirmar !== 'si') {
          b.dataset.confirmar = 'si'; b.textContent = 'Pulsa otra vez para confirmar'; b.classList.add('btn-primario');
          setTimeout(() => { if (b.isConnected) { b.dataset.confirmar = ''; b.textContent = 'Volver a los datos de los informes'; b.classList.remove('btn-primario'); } }, 4000);
        } else {
          app.estado = clonar(DATOS_ORIGINALES); app.esc = null; guardar(); render(true); toast('Datos restaurados desde los informes');
        }
        break;
      case 'preset': {
        const p = DATOS_ORIGINALES.presetsTiempos[b.dataset.preset];
        ['A', 'B', 'C'].forEach((id) => { const el = app.estado.estudioTiempos.elementos.find((x) => x.id === id); if (el) el.observado = p[id]; });
        app.esc = null; guardar(); rerender(); toast(p.nombre + ' cargado');
        break;
      }
      case 'esc-restablecer': app.esc = escenarioBase(); rerender(); break;
      case 'esc-aplicar': {
        const x = app.esc, P = app.estado.parametros;
        const actualParam = (clave) => (clave === 'operariosDisponibles' ? M.operariosDisponibles(app.estado) : P[clave].valor);
        const cambio = (clave, v) => { if (Math.abs(actualParam(clave) - v) > 1e-9) { P[clave].valor = v; P[clave].calidad = 'ingresado'; P[clave].fuente = 'Dato ingresado en el planificador'; } };
        cambio('jornadaHoras', x.jornada); cambio('pedido', x.pedido); cambio('operariosDisponibles', x.operarios); cambio('disponibilidad', x.disponibilidad);
        const p = DATOS_ORIGINALES.presetsTiempos[x.metodo];
        ['A', 'B', 'C'].forEach((id) => { const el = app.estado.estudioTiempos.elementos.find((k) => k.id === id); if (el) el.observado = p[id]; });
        const cuerpo = app.estado.estaciones.find((k) => k.id === 'cuerpo'); if (cuerpo) cuerpo.enTaller = !x.cuerpoExterno;
        app.esc = null; guardar(); rerender(); toast('Escenario aplicado a los datos');
        break;
      }
      default: break;
    }
  });

  document.addEventListener('mouseover', (ev) => {
    const tip = ev.target.closest && ev.target.closest('.tip');
    if (tip && window.matchMedia('(hover: hover)').matches && (!popover || popover._btn !== tip)) mostrarTip(tip);
  });
  document.addEventListener('mouseout', (ev) => {
    const tip = ev.target.closest && ev.target.closest('.tip');
    if (tip && popover && popover._btn === tip && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('.tip') === tip)) cerrarTip();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarTip(); });
  window.addEventListener('scroll', cerrarTip, { passive: true });

  async function exportar(b) {
    if (b) { b.disabled = true; b.dataset.texto = b.textContent; b.textContent = 'Preparando Excel…'; }
    try {
      await window.ExcelKleinfor.exportar(app.estado, app.pref.modelo);
      toast('Excel descargado');
    } catch (e) {
      toast(/librería/.test(e.message) ? 'Sin internet no se puede generar el Excel' : 'El navegador no permitió descargar el archivo');
    } finally {
      if (b && b.isConnected) { b.disabled = false; b.textContent = b.dataset.texto; }
    }
  }

  async function importar(archivo) {
    if (!archivo) return;
    try {
      if (/\.json$/i.test(archivo.name)) {
        const obj = validarEstado(JSON.parse(await archivo.text()));
        if (!obj) { toast('El archivo no tiene el formato del planificador'); return; }
        app.estado = obj; app.esc = null; guardar(); render(true); toast('Datos cargados');
        return;
      }
      const { estado, cambios } = await window.ExcelKleinfor.importar(archivo, app.estado);
      app.estado = estado; app.esc = null; guardar(); render(true);
      toast(cambios ? `Excel cargado: ${cambios} ${cambios === 1 ? 'dato actualizado' : 'datos actualizados'}` : 'Excel cargado: los datos ya coincidían');
    } catch (e) {
      toast(e.message === 'formato' ? 'El Excel no tiene las hojas del planificador' : /librería/.test(e.message) ? 'Sin internet no se puede leer el Excel' : 'No se pudo leer el archivo');
    }
  }

  function cambiarTema() {
    const nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    app.pref.tema = nuevo; guardarPref();
    actualizarBotonTema();
  }

  /* Tema claro por defecto; el oscuro solo si se eligió con el botón */
  document.documentElement.dataset.theme = app.pref.tema === 'dark' ? 'dark' : 'light';
  window.addEventListener('hashchange', () => { render(true); window.scrollTo(0, 0); });
  render(true);
})();
