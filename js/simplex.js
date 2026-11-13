/* ==========================================================================
   Motor Simplex · variante Cj − Zj con M grande (formato del curso)
   - Restricciones ≤ : variable de holgura  h  (+1, costo 0)
   - Restricciones ≥ : superávit  s  (−1, costo 0) + artificial  A
   - Restricciones = : artificial  A
   - Artificiales: costo −M al maximizar, +M al minimizar (M simbólica)
   Entra la variable con el Cj − Zj más positivo (max) o más negativo (min).
   Sale la de menor razón de cambio positiva bj / aij.
   Si se detecta ciclaje por degeneración se cambia a la regla de Bland.
   ========================================================================== */
(function (global) {
  'use strict';

  const EPS = 1e-9;

  /* Valores con M: [c, m] representa c + m·M */
  const MV = {
    de: (c = 0, m = 0) => [c, m],
    sumar: (a, b) => [a[0] + b[0], a[1] + b[1]],
    restar: (a, b) => [a[0] - b[0], a[1] - b[1]],
    escalar: (a, k) => [a[0] * k, a[1] * k],
    comparar(a, b) {
      const dm = a[1] - b[1];
      if (Math.abs(dm) > EPS) return dm > 0 ? 1 : -1;
      const dc = a[0] - b[0];
      if (Math.abs(dc) > EPS) return dc > 0 ? 1 : -1;
      return 0;
    },
    signo(a) { return MV.comparar(a, [0, 0]); },
  };

  const limpiar = (x) => (Math.abs(x) < 1e-10 ? 0 : x);

  /* ---------- Formato de números ---------- */
  function aFraccion(x, maxDen = 1000) {
    if (!isFinite(x)) return null;
    const signo = x < 0 ? -1 : 1;
    let v = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = v;
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(v - h1 / k1) < 1e-9) return { num: signo * h1, den: k1 };
      b = 1 / (b - a);
      if (!isFinite(b)) break;
    }
    return Math.abs(v - h1 / k1) < 1e-9 ? { num: signo * h1, den: k1 } : null;
  }

  function fmt(x, opciones = {}) {
    const dec = opciones.decimales ?? 4;
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    const v = limpiar(x);
    if (Math.abs(v - Math.round(v)) < 1e-9) return signoTexto(Math.round(v));
    if (opciones.fracciones) {
      const f = aFraccion(v);
      if (f && f.den !== 1) return (f.num < 0 ? '−' : '') + Math.abs(f.num) + '/' + f.den;
    }
    let s = v.toFixed(dec);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (/^-?0$/.test(s)) s = '0';
    return signoTexto(s);
  }
  function signoTexto(v) { return String(v).replace(/^-/, '−'); }

  /* c + m·M → texto, p. ej. "20 − 3M" */
  function fmtM(a, opciones = {}) {
    const c = limpiar(a[0]), m = limpiar(a[1]);
    if (Math.abs(m) < EPS) return fmt(c, opciones);
    const mAbs = Math.abs(m);
    const parteM = (Math.abs(mAbs - 1) < EPS ? '' : fmt(mAbs, opciones)) + 'M';
    if (Math.abs(c) < EPS) return (m < 0 ? '−' : '') + parteM;
    return fmt(c, opciones) + (m < 0 ? ' − ' : ' + ') + parteM;
  }

  /* expresión lineal en d: c0 + c1·d → texto */
  function fmtLinealD(c0, c1, opciones = {}) {
    const a = limpiar(c0), b = limpiar(c1);
    const tD = Math.abs(b) < EPS ? '' : (Math.abs(Math.abs(b) - 1) < EPS ? 'd' : fmt(Math.abs(b), opciones) + 'd');
    if (!tD) return fmt(a, opciones);
    if (Math.abs(a) < EPS) return (b < 0 ? '−' : '') + tD;
    return fmt(a, opciones) + (b < 0 ? ' − ' : ' + ') + tD;
  }

  const LETRAS = 'abcdefghijklmnopqrstuvwxyz';
  function etiquetaFila(i, primas) {
    const base = i < 26 ? LETRAS[i] : 'r' + (i + 1);
    if (primas === 0) return base;
    if (primas <= 3) return base + "'".repeat(primas);
    return base + '⁽' + primas + '⁾';
  }

  /* ---------- Resolver ---------- */
  function resolver(lp) {
    const maximizar = lp.sentido === 'max';
    const nVars = lp.variables.length;

    const restr = lp.restricciones.map((r) => {
      let coef = r.coef.slice(), rhs = r.rhs, tipo = r.tipo, invertida = false;
      if (rhs < 0) {
        coef = coef.map((v) => -v); rhs = -rhs; invertida = true;
        tipo = tipo === '<=' ? '>=' : tipo === '>=' ? '<=' : '=';
      }
      return Object.assign({}, r, { coef, rhs, tipo, invertida });
    });
    const m = restr.length;

    const cols = lp.variables.map((v, j) => ({ nombre: v.nombre, tipo: 'dec', costo: MV.de(lp.objetivo[j]), restr: -1 }));
    const colHolgura = new Array(m).fill(-1), colArtificial = new Array(m).fill(-1);
    let nh = 0, ns = 0, na = 0;
    restr.forEach((r, i) => {
      if (r.tipo === '<=') { nh++; colHolgura[i] = cols.length; cols.push({ nombre: 'h' + nh, tipo: 'h', costo: MV.de(0), restr: i }); }
      else if (r.tipo === '>=') { ns++; colHolgura[i] = cols.length; cols.push({ nombre: 's' + ns, tipo: 's', costo: MV.de(0), restr: i }); }
    });
    restr.forEach((r, i) => {
      if (r.tipo !== '<=') { na++; colArtificial[i] = cols.length; cols.push({ nombre: 'A' + na, tipo: 'A', costo: MV.de(0, maximizar ? -1 : 1), restr: i }); }
    });
    const n = cols.length;

    const A = restr.map((r, i) => {
      const fila = new Array(n).fill(0);
      r.coef.forEach((v, j) => { fila[j] = v; });
      if (r.tipo === '<=') fila[colHolgura[i]] = 1;
      if (r.tipo === '>=') { fila[colHolgura[i]] = -1; fila[colArtificial[i]] = 1; }
      if (r.tipo === '=') fila[colArtificial[i]] = 1;
      return fila;
    });
    const b = restr.map((r) => r.rhs);
    const base = restr.map((r, i) => (r.tipo === '<=' ? colHolgura[i] : colArtificial[i]));
    const colInicial = base.slice();

    const iteraciones = [];
    let primas = 0;
    let ops = null;
    let estado = 'limite';
    let reglaBland = false;
    const vistas = new Set([base.join(',')]);

    for (let it = 0; it < 300; it++) {
      const CB = base.map((j) => cols[j].costo);
      const Zj = cols.map((_, j) => base.reduce((acc, _bj, r) => MV.sumar(acc, MV.escalar(CB[r], A[r][j])), MV.de()));
      const Zb = base.reduce((acc, _bj, r) => MV.sumar(acc, MV.escalar(CB[r], b[r])), MV.de());
      const delta = cols.map((c, j) => MV.restar(c.costo, Zj[j]));
      const etiquetas = restr.map((_, i) => etiquetaFila(i, primas));

      const tabla = {
        n: it, base: base.slice(), CB: CB.map((x) => x.slice()), A: A.map((f) => f.slice()), b: b.slice(),
        Zj, Zb, delta, etiquetas, ops, entra: null, sale: null, razones: null, pivote: null, regla: reglaBland ? 'Bland' : 'Cj − Zj',
      };
      iteraciones.push(tabla);

      const mejora = (j) => (maximizar ? MV.signo(delta[j]) > 0 : MV.signo(delta[j]) < 0);
      const candidatos = cols.map((_, j) => j).filter((j) => !base.includes(j) && mejora(j));
      if (!candidatos.length) { estado = 'optimo'; break; }

      let e;
      if (reglaBland) e = candidatos[0];
      else {
        e = candidatos[0];
        candidatos.forEach((j) => {
          const c = MV.comparar(delta[j], delta[e]);
          if (maximizar ? c > 0 : c < 0) e = j;
        });
      }

      const razones = A.map((f, r) => (f[e] > EPS ? b[r] / f[e] : null));
      let s = -1;
      razones.forEach((q, r) => {
        if (q === null) return;
        if (s < 0 || q < razones[s] - EPS) { s = r; return; }
        if (Math.abs(q - razones[s]) <= EPS && reglaBland && base[r] < base[s]) s = r;
      });
      tabla.entra = e; tabla.razones = razones;
      if (s < 0) { estado = 'no_acotado'; break; }
      tabla.sale = s; tabla.pivote = A[s][e];

      /* Gauss-Jordan */
      const p = A[s][e];
      const factores = A.map((f) => f[e]);
      const ant = restr.map((_, i) => etiquetaFila(i, primas));
      const nue = restr.map((_, i) => etiquetaFila(i, primas + 1));
      const nuevasOps = [];
      A[s] = A[s].map((v) => limpiar(v / p));
      b[s] = limpiar(b[s] / p);
      nuevasOps[s] = { texto: `${nue[s]} = ${ant[s]} / ${fmt(p)}`, pivote: true };
      for (let r = 0; r < m; r++) {
        if (r === s) continue;
        const f = factores[r];
        if (Math.abs(f) < EPS) { nuevasOps[r] = { texto: `${nue[r]} = ${ant[r]}` }; continue; }
        A[r] = A[r].map((v, j) => limpiar(v - f * A[s][j]));
        b[r] = limpiar(b[r] - f * b[s]);
        nuevasOps[r] = { texto: f > 0 ? `${nue[r]} = ${ant[r]} − ${fmt(f)}·${nue[s]}` : `${nue[r]} = ${ant[r]} + ${fmt(-f)}·${nue[s]}` };
      }
      base[s] = e;
      primas++;
      ops = nuevasOps;
      const firma = base.join(',');
      if (vistas.has(firma)) reglaBland = true;
      vistas.add(firma);
    }

    const final = iteraciones[iteraciones.length - 1];
    if (estado === 'optimo') {
      const artificialPositiva = final.base.some((j, r) => cols[j].tipo === 'A' && final.b[r] > 1e-7);
      if (artificialPositiva) estado = 'infactible';
    }

    const valores = new Array(n).fill(0);
    final.base.forEach((j, r) => { valores[j] = final.b[r]; });
    const resultado = {
      estado, maximizar, lp, restr, cols, iteraciones, final, colInicial, colHolgura, colArtificial,
      valores, z: limpiar(final.Zb[0]), nVars,
    };
    if (estado === 'optimo') resultado.sensibilidad = sensibilidad(resultado);
    return resultado;
  }

  /* ---------- Análisis de sensibilidad sobre el tablero óptimo ---------- */
  function sensibilidad(res) {
    const { final, restr, cols, colInicial, maximizar, lp } = res;
    const m = restr.length;
    const Binv = final.A.map((fila) => colInicial.map((c) => fila[c]));
    const CB = final.CB.map((x) => x[0]);
    const delta = final.delta.map((x) => x[0]);

    /* Precios sombra y = CB·B⁻¹ (cambio de Z por unidad adicional de bj) */
    const precios = restr.map((r, i) => {
      let y = 0;
      for (let k = 0; k < m; k++) y += CB[k] * Binv[k][i];
      y = limpiar(y);
      const yOriginal = r.invertida ? -y : y;
      const holgura = res.colHolgura[i] >= 0 ? limpiar(res.valores[res.colHolgura[i]]) : 0;
      /* comprobación: B⁻¹·(b + 1 en la restricción i) */
      const nuevoB = final.b.map((bb, k) => limpiar(bb + Binv[k][i]));
      const zNuevo = limpiar(nuevoB.reduce((acc, v, k) => acc + CB[k] * v, 0));
      return { i, y: yOriginal, holgura, nuevoB, zNuevo, factible: nuevoB.every((v) => v >= -1e-9) };
    });

    /* Rango de bj: B⁻¹·b' ≥ 0 con b'i = bi + d */
    const rangosB = restr.map((r, i) => {
      let dmin = -Infinity, dmax = Infinity;
      const condiciones = final.b.map((bb, k) => {
        const c = Binv[k][i];
        if (c > EPS) { const lim = -bb / c; dmin = Math.max(dmin, lim); return { k, b: bb, c, sentido: '≥', lim }; }
        if (c < -EPS) { const lim = -bb / c; dmax = Math.min(dmax, lim); return { k, b: bb, c, sentido: '≤', lim }; }
        return { k, b: bb, c: 0, sentido: 'siempre' };
      });
      /* si la fila se invirtió al normalizar, d cambia de signo */
      if (r.invertida) { const t = dmin; dmin = -dmax; dmax = -t; }
      const bOriginal = r.invertida ? -r.rhs : r.rhs;
      return { i, dmin, dmax, min: bOriginal + dmin, max: bOriginal + dmax, condiciones, invertida: r.invertida };
    });

    /* Rango de Cj de las variables de decisión: Cj → Cj + d y condición de optimalidad */
    const noBasicas = cols.map((_, j) => j).filter((j) => !final.base.includes(j) && cols[j].tipo !== 'A');
    const rangosC = lp.variables.map((v, k) => {
      const fila = final.base.indexOf(k);
      const cj = lp.objetivo[k];
      if (fila < 0) {
        const d = delta[k];
        const condiciones = [{ j: k, d, t: -1, sentido: maximizar ? '≤' : '≥', lim: -d }];
        return maximizar
          ? { k, basica: false, dmin: -Infinity, dmax: -d, min: -Infinity, max: cj - d, condiciones }
          : { k, basica: false, dmin: -d, dmax: Infinity, min: cj - d, max: Infinity, condiciones };
      }
      let dmin = -Infinity, dmax = Infinity;
      const condiciones = noBasicas.map((j) => {
        const t = final.A[fila][j], d = delta[j];
        if (Math.abs(t) < EPS) return { j, d, t: 0, sentido: 'siempre' };
        const lim = d / t;
        if (maximizar) {
          if (t > 0) { dmin = Math.max(dmin, lim); return { j, d, t, sentido: '≥', lim }; }
          dmax = Math.min(dmax, lim); return { j, d, t, sentido: '≤', lim };
        }
        if (t > 0) { dmax = Math.min(dmax, lim); return { j, d, t, sentido: '≤', lim }; }
        dmin = Math.max(dmin, lim); return { j, d, t, sentido: '≥', lim };
      });
      return { k, basica: true, fila, dmin, dmax, min: cj + dmin, max: cj + dmax, condiciones };
    });

    const w = limpiar(restr.reduce((acc, r, i) => acc + (r.invertida ? -r.rhs : r.rhs) * precios[i].y, 0));
    return { Binv, precios, rangosB, rangosC, w, noBasicas };
  }

  const Simplex = { resolver, fmt, fmtM, fmtLinealD, MV, EPS, limpiar };
  if (typeof module !== 'undefined' && module.exports) module.exports = Simplex;
  else global.Simplex = Simplex;
})(typeof window !== 'undefined' ? window : globalThis);
