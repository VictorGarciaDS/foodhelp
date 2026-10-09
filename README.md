# FoodHelp

Aplicacion familiar privada en espanol. Render sirve React/Vite y Express desde un unico servicio web; PostgreSQL Neon es una dependencia de ejecucion configurada solo por `DATABASE_URL`. No hay servicios Azure.

## Desarrollo

Requisitos: Node.js 20 o posterior y npm.

```sh
npm install
npm run build
npm test
npm start
```

La API inicia en `http://localhost:3000`; durante el desarrollo de interfaz puede ejecutarse `npm run dev --workspace=@foodhelp/web`. El servidor Express sirve el build web cuando existe.

Copie `.env.example` a `.env` solo si necesita configurar servicios. No se proporciona una URL de base de datos. Para habilitar acceso privado en Render, configure `APP_AUTH_USERNAME` y un hash bcrypt en `APP_AUTH_PASSWORD_HASH`; genere el hash localmente con `npm run auth:hash` y escriba la contrasena directamente en el terminal, nunca en el chat. Produccion se niega a iniciar si faltan estas dos variables. Es una credencial familiar compartida mediante HTTP Basic sobre HTTPS, no cuentas individuales ni sesiones de usuario.

Las migraciones de catalogo y prescripciones incluyen solo datos proporcionados por la familia. Personas almacena identificador, nombre y fecha de creacion; no se capturan restricciones ni alergias. La generacion de menus permanece bloqueada hasta contar con un planificador aprobado, datos verificados y recetas que respeten las equivalencias. Las propuestas externas permanecen apagadas hasta configurar el secreto y confirmar expresamente el contrato de respuesta. Los PDFs se crean en memoria bajo demanda y no se guardan.

## Base de datos

Desde Personas se consultan las prescripciones mensuales completas, se agregan meses y se editan todas sus indicaciones. El editor conserva fecha de consulta, verduras libres, alimentos preferidos y notas. Eliminar requiere confirmacion y borra la prescripcion con sus filas; no borra a la persona. El mes de una prescripcion existente no se cambia desde el editor.

La migracion `0005_recipe_drafts.sql` guarda las siete propuestas de Patricia como borradores, con texto original y pendientes de revision. Recetas permite abrir su detalle; estos borradores no estan verificados ni se usan como recetas aprobadas para generar menus. No se inventan ingredientes normalizados ni pasos de preparacion.

Las migraciones estan en `services/foodhelp-api/src/db/migrations`. Cada objeto pertenece al esquema `foodhelp`; no altera otros esquemas. No se ejecutan automaticamente al iniciar el servidor. Para aplicarlas en Neon configure `DATABASE_URL` y `FOODHELP_ALLOW_NEON_MIGRATIONS=1`, y ejecute `npm run migrate:neon --workspace=@foodhelp/api`. El runner exige TLS verificado y un host Neon. No publique secretos en el repositorio; rote las credenciales compartidas antes de un despliegue real.

## Despliegue

Use un Render Web Service unico con build `npm ci && npm run build`, start `npm start`, `PORT` asignado por Render y TLS. Configure autenticacion, `DATABASE_URL` con TLS y, solo si se aprueba la integracion IA, las variables `AI_*` en Render. No publique la aplicacion sin proteccion de acceso activa. `GET /api/health` no expone secretos.
