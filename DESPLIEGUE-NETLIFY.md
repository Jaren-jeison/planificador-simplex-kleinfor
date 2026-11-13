# Publicar el planificador en Netlify

El planificador es un sitio estático (HTML, CSS y JavaScript). Netlify lo publica tal cual: no hay comando de compilación ni base de datos.

## Opción A · Desde GitHub (recomendada)

Cada vez que subas cambios a GitHub, Netlify vuelve a publicar el sitio solo.

1. Entra a <https://app.netlify.com> y elige **Sign up / Log in with GitHub**. Usa la misma cuenta donde está el repositorio `planificador-simplex-kleinfor`.
2. Pulsa **Add new project → Import an existing project**. En versiones anteriores del panel el botón se llama **Add new site**.
3. Elige **GitHub**. La primera vez, GitHub pide autorizar a Netlify. Si el repositorio es privado, en **Configure the Netlify app on GitHub** dale acceso a `planificador-simplex-kleinfor` (o a todos los repositorios).
4. Selecciona el repositorio `planificador-simplex-kleinfor`.
5. En la configuración del despliegue:
   - **Branch to deploy:** `main`
   - **Base directory:** vacío
   - **Build command:** vacío
   - **Publish directory:** `.` (un punto) o vacío
6. Pulsa **Deploy**. En menos de un minuto aparece una dirección del tipo `https://palabras-al-azar-123.netlify.app`.
7. Para un nombre fácil de dictar, entra a **Project configuration → Change project name** (o **Site configuration → Change site name**). Por ejemplo: `planificador-kleinfor` → `https://planificador-kleinfor.netlify.app`. El nombre debe estar libre.

Para actualizar el sitio después: haz cambios, `git add .`, `git commit -m "..."`, `git push`. Netlify lo vuelve a publicar en unos segundos.

## Opción B · Arrastrar la carpeta (sin GitHub)

1. Entra a <https://app.netlify.com/drop> con tu cuenta.
2. Arrastra la carpeta `planificador-simplex-kleinfor` completa a la página.
3. Cambia el nombre del sitio como en el paso 7 de la opción A.

Para actualizarlo: en el sitio, ve a **Deploys** y arrastra la carpeta otra vez. Si no inicias sesión, el sitio se borra a la hora.

## Antes de la presentación

- Abre la dirección en la computadora del aula y en un celular.
- Recorre **Planteamiento → Tablas Simplex → Análisis de sensibilidad** y prueba **Descargar en Excel**. El Excel necesita internet porque la librería se descarga al pulsar el botón.
- Si cambiaste datos en el navegador y quieres volver a los de los informes, usa **Datos de la empresa → Volver a los datos de los informes**.
- Si después de publicar cambios ves una versión vieja, recarga con **Ctrl + F5**.
