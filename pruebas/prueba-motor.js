/* Prueba del motor Simplex contra ejercicios con resultado conocido.
   Ejecutar desde la carpeta del proyecto:  node pruebas/prueba-motor.js */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ctx = { console };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
['datos.js', 'simplex.js', 'modelos.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
const S = ctx.Simplex;
const M = ctx.Modelos;

let fallas = 0;
function cerca(a, b, tol = 1e-4) { return Math.abs(a - b) <= tol || (a === b); }
function verificar(nombre, condicion, detalle) {
  console.log(`${condicion ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' · ' + detalle : ''}`);
  if (!condicion) fallas++;
}
const lp = (sentido, objetivo, restricciones) => ({
  sentido, objetivo,
  variables: objetivo.map((_, j) => ({ nombre: 'x' + (j + 1) })),
  restricciones: restricciones.map(([coef, tipo, rhs]) => ({ coef, tipo, rhs })),
});

/* 1. Modelo del equipo (Excel de sensibilidad) */
let r = S.resolver(lp('max', [1, 1, 1], [[[43.08, 43.08, 43.08], '<=', 28800], [[1, 1, 1], '<=', 200]]));
verificar('KLEINFOR: Z = 200 con x1 = 200', r.estado === 'optimo' && cerca(r.z, 200) && cerca(r.valores[0], 200));
verificar('KLEINFOR: precios sombra 0 y 1', cerca(r.sensibilidad.precios[0].y, 0) && cerca(r.sensibilidad.precios[1].y, 1));
verificar('KLEINFOR: 8616 ≤ b1 < ∞', cerca(r.sensibilidad.rangosB[0].min, 8616) && r.sensibilidad.rangosB[0].max === Infinity);
verificar('KLEINFOR: 0 ≤ b2 ≤ 668.52', cerca(r.sensibilidad.rangosB[1].min, 0) && cerca(r.sensibilidad.rangosB[1].max, 668.5237));
verificar('KLEINFOR: 1 ≤ C1 < ∞ y C2 ≤ 1', cerca(r.sensibilidad.rangosC[0].min, 1) && cerca(r.sensibilidad.rangosC[1].max, 1));

/* 2. Excel del curso, problema 2: Max 5X1 + 4X2 */
r = S.resolver(lp('max', [5, 4], [[[2, 1], '<=', 20], [[1, 1], '<=', 18], [[1, 2], '>=', 12]]));
verificar('Problema 2: X1 = 2, X2 = 16, Z = 74', cerca(r.valores[0], 2) && cerca(r.valores[1], 16) && cerca(r.z, 74));
verificar('Problema 2: 4 ≤ C1 ≤ 8 y 2.5 ≤ C2 ≤ 5', cerca(r.sensibilidad.rangosC[0].min, 4) && cerca(r.sensibilidad.rangosC[0].max, 8) && cerca(r.sensibilidad.rangosC[1].min, 2.5) && cerca(r.sensibilidad.rangosC[1].max, 5));
verificar('Problema 2: 10.67 ≤ b2 ≤ 20', cerca(r.sensibilidad.rangosB[1].min, 10.6667) && cerca(r.sensibilidad.rangosB[1].max, 20));

/* 3. Ejemplo ATSA de minimización con M grande */
r = S.resolver(lp('min', [500, 2000], [[[3, 2], '>=', 36], [[6, 3], '>=', 60]]));
verificar('ATSA: Xp = 12, C = 6000', cerca(r.valores[0], 12) && cerca(r.z, 6000));

/* 4. Ejemplo FMA: operaciones de fila del formato del curso */
r = S.resolver(lp('max', [200, 240], [[[6, 12], '<=', 120], [[8, 4], '<=', 64]]));
verificar('FMA: Z = 2720', cerca(r.z, 2720));
verificar("FMA: operaciones a' = a / 12 y b' = b − 4·a'", r.iteraciones[1].ops[0].texto === "a' = a / 12" && r.iteraciones[1].ops[1].texto === "b' = b − 4·a'");

/* 5. Restricción de igualdad, problema no acotado e infactible */
r = S.resolver(lp('min', [30, 10], [[[2, 4], '<=', 80], [[1, 1], '=', 25], [[8, 6], '>=', 120]]));
verificar('Igualdad: X1 = 10, X2 = 15, Z = 450', cerca(r.valores[0], 10) && cerca(r.valores[1], 15) && cerca(r.z, 450));
verificar('No acotado', S.resolver(lp('max', [1, 1], [[[1, -1], '<=', 1]])).estado === 'no_acotado');
verificar('Infactible', S.resolver(lp('max', [1], [[[1], '<=', 1], [[1], '>=', 3]])).estado === 'infactible');

/* 6. Modelos de planta con los datos de los informes */
const estado = JSON.parse(JSON.stringify(vm.runInContext('DATOS_ORIGINALES', ctx)));
const ind = M.indicadores(estado);
verificar('Tiempo estándar del botonado = 43.0836 s', cerca(M.tiempoEstandarBotonado(estado.estudioTiempos).total, 43.0836, 1e-3));
verificar('Planta actual: frena Ensamble con 61.54 camisas', ind.c.limite.nombre === 'Ensamble' && cerca(ind.capacidadActual, 61.5385, 1e-3));
verificar('Planta óptima: 177.68 camisas con 12 operarios', cerca(ind.produccionOptima, 177.6787, 1e-3));
verificar('Personal necesario para 200 camisas = 13.51', cerca(ind.c.requeridosTotal, 13.5075, 1e-3));
verificar('Dualidad en la planta óptima: W = Z', cerca(ind.optimo.res.sensibilidad.w, ind.optimo.res.z, 1e-6));

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
