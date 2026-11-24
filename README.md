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

Las recetas base tienen `person_id = NULL`. Cada perfil conserva sus propias copias, enlazadas por `inherited_from_recipe_id`; editar una copia no modifica la base ni otro perfil. La migracion `0015` conserva los IDs de las recetas de Patricia y crea sus bases independientes. En Recetas se selecciona Recetas base o un perfil. Al guardar una prescripcion nueva o pulsar Copiar recetas base se copian las que falten y se comparan sus equivalentes con el perfil para ajustar cantidades y verificar; una prescripcion incompatible deja la copia como borrador. La validacion de una base solo confirma sus ingredientes de catalogo, no el cumplimiento de una prescripcion personal.

Colacion forma parte de los tiempos de comida y se inicializa con cero en los siete grupos de todas las prescripciones actuales y futuras. Personas muestra una matriz de tiempos con Total por dia, sumado exactamente por grupo, sin sustituir el detalle de indicaciones. Compras sigue requiriendo los cuatro tiempos principales, sin inventar una receta de Colacion cuando su prescripcion esta en cero.

El editor acepta rutas locales `/images/...` y URLs https. En una actualizacion, omitir los campos de imagen conserva sus valores; enviar `null` los elimina explicitamente. La unidad de ingredientes porcionados se toma del catalogo y no es editable; los alimentos libres conservan medidas de compra editables. Al guardar se consolidan filas de un mismo alimento y unidad sumando cantidades exactas, sin fusionar unidades incompatibles.

La migracion `0014` incorpora Queso cotija con 35 g por equivalente de Proteinas. `scripts/update-family-recipes.cjs` respalda los datos y aplica las correcciones de mole con res/pollo, tazon con panela, taco con espinacas y crema, y nogada con leche, pasas y platano. La base del taco incluye papa; la copia de Patricia conserva 2 tortillas sin papa para mantener sus 2 cereales. La nogada se mantiene como borrador de Comida por Frutas y Azucar no prescritos en ese tiempo.

Al seleccionar un alimento en Recetas, la cantidad sugerida cubre las porciones restantes de su grupo para el perfil y tiempo seleccionados. Otros ingredientes del mismo grupo se descuentan antes de sugerir la cantidad. Excesos y faltantes se muestran como alertas exactas; no impiden guardar un borrador. Verificar sigue requiriendo que todos los grupos y equivalencias coincidan con la prescripcion. Los alimentos libres no reciben equivalencias; las cantidades domesticas registradas para recetas se usan solo en compras.

Compras separa de 1 a 3 menus distintos (`days` en la solicitud) de 1 a 3 dias por platillo (`daysPerDish`, 1 si se omite). Cada menu contiene una receta por tiempo de comida. Primero se multiplica cada ingrediente por `peopleCount * daysPerDish` y despues se suman los ingredientes comunes de todos los menus. Dos menus de dos dias cubren cuatro dias: el primer menu se come los dias 1 y 2, el segundo los dias 3 y 4. La respuesta `days` es el total de dias cubiertos; `menuCount` y `daysPerDish` conservan ambos factores. Las cantidades parten de recetas verificadas contra la prescripcion, sin convertir equivalentes de grupos en gramos arbitrarios. Desayuno y Cena pueden repetirse entre menus; Almuerzo y Comida deben variar entre menus consecutivos.

`food_purchase_units` relaciona cada alimento con uno o mas empaques; admite conversiones aproximadas, compras por peso/volumen y estados por confirmar. Las conversiones a empaques se aplican despues de sumar, redondeando solo cuando corresponde. Una conversion solo resuelve la compra si coincide con la unidad del ingrediente. Las migraciones `0012` y `0013` registran las confirmaciones familiares: taza de 250 ml, leches en caja de 1 L, Oroweat de 16 rebanadas, domino por pieza y rendimientos aproximados de coccion autorizados. Arroz y legumbres se compran crudos con rendimiento 1:3; pasta 1:2. Habits de 1 kg sigue pendiente del peso por cucharada. Los demas datos no confirmados se detallan en [el informe de unidades pendientes](docs/purchase-units-pending.md).

El PDF de Compras incluye Menu, Recetas y Lista, en ese orden. Los pasos guardados de cada platillo seleccionado aparecen una sola vez, agrupados por Desayuno, Almuerzo, Comida y Cena. No se generan ni inventan instrucciones; una receta sin pasos registrados se indica como tal.

Para revisar preparaciones, `FOODHELP_API_ORIGIN=http://localhost:3002 node scripts/complete-recipe-preparations.cjs` simula los cambios; `--research` consulta las referencias y `--apply` guarda un respaldo temporal antes de actualizar mediante la API. Las preparaciones son adaptaciones al catalogo, no transcripciones de las fuentes; conservan los ingredientes y cantidades. La fruta se sirve al final salvo cuando pertenece realmente al relleno de la nogada. Las recetas verificadas se revalidan con la prescripcion al guardar; los borradores no se promueven automaticamente. `node --test scripts/recipe-preparations.test.cjs` comprueba estas reglas.

Las recetas pueden guardar una imagen externa con fuente, autor y licencia. Las cuatro recetas nuevas usan imagenes de Wikimedia Commons bajo CC BY, CC BY-SA o CC0; el detalle muestra la atribucion correspondiente. Los alimentos sin conversion de compra conocida se muestran como `Empaque por confirmar` hasta que se verifique el formato familiar.

La integracion de completions envia `prompt` y `system_prompt`, sin `messages`: el proveedor prioriza `messages` e ignora los prompts cuando ese campo esta presente. Usa `max_tokens=6000` (se traduce a `max_completion_tokens` en el servicio) y lee el JSON de recetas desde la propiedad `text` de la respuesta. Solo se guardan propuestas que pasan la validacion exacta del servidor. La clave permanece exclusivamente en el backend.

Desde Personas se consultan las prescripciones mensuales completas, se agregan meses y se editan todas sus indicaciones. El editor conserva fecha de consulta, verduras libres, alimentos preferidos y notas. Eliminar requiere confirmacion y borra la prescripcion con sus filas; no borra a la persona. El mes de una prescripcion existente no se cambia desde el editor.

La migracion `0005_recipe_drafts.sql` guardo inicialmente siete propuestas de Patricia como borradores. Tras las confirmaciones familiares se verificaron cuatro; permanecen pendientes el rollo de carne (tocino), el burrito (tamano de tortilla) y la nogada con fruta conservada en Comida por decision familiar. La prescripcion de Comida no incluye Frutas, por lo que la nogada no se verifica ni se incluye en el calculo de compras. Los borradores no se usan como recetas aprobadas.

Las migraciones estan en `services/foodhelp-api/src/db/migrations`. Cada objeto pertenece al esquema `foodhelp`; no altera otros esquemas. No se ejecutan automaticamente al iniciar el servidor. Para aplicarlas en Neon configure `DATABASE_URL` y `FOODHELP_ALLOW_NEON_MIGRATIONS=1`, y ejecute `npm run migrate:neon --workspace=@foodhelp/api`. El runner exige TLS verificado y un host Neon. No publique secretos en el repositorio; rote las credenciales compartidas antes de un despliegue real.

## Despliegue

Use un Render Web Service unico con build `npm ci --include=dev && npm run build`, start `npm start`, `PORT` asignado por Render y TLS. Configure autenticacion, `DATABASE_URL` con TLS y, solo si se aprueba la integracion IA, las variables `AI_*` en Render. No publique la aplicacion sin proteccion de acceso activa. `GET /api/health` no expone secretos.

El build genera miniaturas WebP locales con Sharp en `public/images/thumbnails`: 76 x 64 para recetas y 32 x 32 para alimentos. Los listados usan estas copias; Ver detalle conserva la imagen original de la receta. Para regenerarlas sin compilar, ejecute `npm run images:thumbnails`. Los originales no se modifican y no se necesita cambiar la base de datos. Incluya Sharp y el lockfile en el commit; Render necesita instalar las dependencias de desarrollo durante el build.

El servidor escucha en `0.0.0.0` y configura keep-alive de 65 segundos con timeout de cabeceras de 66 segundos para evitar cierres prematuros frente al proxy. La autenticacion reutiliza durante cinco minutos una huella HMAC de credenciales previamente verificadas, sin almacenar la contrasena, para evitar bcrypt en cada imagen. Credenciales distintas se verifican normalmente.

Si Render responde 502, revise Logs, Events y Metrics en el horario del error: reinicios, fallos de health check y consumo de CPU/memoria. Un 401 en `/shopping` significa que FoodHelp esta respondiendo y solicita autenticacion; no es un 502. El plan Free se suspende tras 15 minutos sin trafico y puede tardar alrededor de un minuto en despertar. Para evitar esa suspension se requiere cambiar el plan del servicio; estos ajustes no eliminan las limitaciones de Free. En Compras, pulse Calcular y luego PDF para descargar `foodhelp-compras.pdf`.
