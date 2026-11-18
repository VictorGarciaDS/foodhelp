const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const reference = (slug) => `https://www.mexicoinmykitchen.com/${slug}/`;

function preparationFor(recipe, foods) {
  const name = normalize(recipe.name);
  const used = new Set();
  const ingredients = recipe.ingredients.map((ingredient) => ({ ...ingredient, name: foods.get(ingredient.foodId)?.name ?? ingredient.name }));
  if (ingredients.some((ingredient) => !ingredient.name)) throw new Error(`Ingrediente desconocido: ${recipe.name}`);
  const matches = (pattern) => ingredients.filter((ingredient) => pattern.test(normalize(ingredient.name)));
  const has = (pattern) => matches(pattern).length > 0;
  const take = (pattern) => {
    const selected = matches(pattern);
    selected.forEach((ingredient) => used.add(ingredient.foodId));
    return [...new Set(selected.map((ingredient) => ingredient.name))].join(', ');
  };
  const steps = [];
  let source;
  const vegetable = /^(zanahoria|calabacita|chayote|brocoli|coliflor|champi|pimiento|espinaca|acelga|huauzontles|flor de calabaza|otras verduras|verduras)/;
  const oil = take(/^aceite /);
  if (oil) steps.push(`Medir el ${oil} registrado y repartirlo entre los pasos de coccion; no usar la cantidad completa de nuevo en cada paso.`);
  const pan = oil ? `con el ${oil} indicado, sin agregar mas grasa` : 'en sarten antiadherente con un poco de agua, sin agregar grasa';
  const tomatoSauce = () => {
    const base = take(/^(jitomate|tomate$|tomatillo|pure de tomate|chile \(todo tipo\)|chiles secos|ajo$|cebolla$|especias$)/);
    if (base) steps.push(`Cocer ${base} hasta ablandar; licuar con un poco del agua de coccion y hervir la salsa a fuego bajo de 5 a 8 minutos.`);
  };
  const chicken = () => {
    const meat = take(/^pechuga de pollo$/);
    if (meat) steps.push(`Cocer ${meat} en agua a hervor suave hasta alcanzar 74 C en el centro; retirar y deshebrar. Conservar el caldo para humedecer la preparacion.`);
  };
  const fish = () => {
    const meat = take(/^(atun fresco|pescado blanco|salmon)$/);
    if (meat) steps.push(`Cocinar ${meat} ${pan}, volteando con cuidado, hasta alcanzar 63 C en el centro; retirar las espinas y desmenuzar si se usara como relleno.`);
  };

  if (/chiles tipo en nogada/.test(name) && ingredients.length < 3) {
    return { blocked: 'Faltan ingredientes y cantidades del relleno y de la nogada; no se puede completar ni verificar sin inventarlos.' };
  }
  if (/chiles tipo en nogada/.test(name)) {
    source = reference('poblano-peppers-in-walnut-sauce');
    steps.push(`Asar ${take(/^chile poblano/)}, cubrir 10 minutos, pelar y abrir a lo largo para retirar venas y semillas, conservando el chile entero.`);
    steps.push(`Cocinar ${take(/^carne molida/)} en sarten antiadherente con ${take(/^(jitomate|cebolla)/)} picados y un poco de agua, sin aceite adicional, hasta que la carne alcance 71 C.`);
    steps.push(`Pelar y picar ${take(/^(manzana|pera|durazno)/)}; agregar al picadillo cocido y calentar de 2 a 3 minutos para conservar su forma.`);
    steps.push(`Licuar ${take(/^nueces/)} con ${take(/^queso cottage/)} y agua suficiente para formar una salsa cremosa; no agregar leche, azucar, crema ni otros ingredientes.`);
    steps.push('Rellenar el chile con el picadillo de fruta, banar con la salsa de nuez y servir sin capear. Esta adaptacion conserva fruta en el relleno; sigue pendiente de autorizacion nutricional para Comida.');
  } else if (/^alambre/.test(name)) {
    source = reference('tacos-de-alambre-recipe');
    const meat = take(/^(pechuga de pollo|bistec de res)$/);
    const vegetables = take(/^(pimiento|nopal|cebolla|champi)/);
    if (has(/^papa /)) steps.push(`Cocer ${take(/^papa /)} en agua hasta que pueda pincharse; escurrir y cortar en cubos.`);
    steps.push(`Cortar ${meat} en tiras y ${vegetables} en trozos pequenos, usando tabla separada para la carne cruda.`);
    steps.push(`Cocinar la carne ${pan}; el pollo debe alcanzar 74 C y el bistec 63 C con 3 minutos de reposo.`);
    steps.push('Agregar las verduras picadas y, si corresponde, la papa precocida; saltear hasta que las verduras esten tiernas, sin quemarlas.');
  } else if (/albondigas/.test(name)) {
    source = reference('mexican-meatball-soup-recipe');
    const meat = take(/^carne molida/);
    const rice = take(/^arroz/);
    steps.push(`Cocer ${rice} en agua y medir la porcion cocida indicada; mezclar con ${meat} y formar bolitas pequenas compactas, sin agregar huevo ni pan.`);
    tomatoSauce();
    const vegetables = take(vegetable);
    steps.push(`Diluir la salsa con agua para obtener un caldo y agregar ${vegetables}, empezando por las verduras mas firmes.`);
    steps.push('Introducir las albondigas en el caldo hirviendo suavemente y tapar; cocinar hasta que las verduras esten tiernas y las albondigas alcancen 71 C en el centro.');
  } else if (/^(caldo|mole de olla)/.test(name)) {
    source = reference(/mole de olla/.test(name) ? 'mole-de-olla-recipe' : /pescado/.test(name) ? 'mexican-shrimp-soup' : 'mexican-chicken-soup-caldo-de-pollo');
    const meat = take(/^(pechuga de pollo|bistec de res|pescado blanco)$/);
    const vegetables = take(vegetable);
    tomatoSauce();
    steps.push(`Llevar agua a hervor suave; agregar ${meat} y retirar la espuma. Para pescado, reservarlo hasta que las verduras esten casi cocidas.`);
    steps.push(`Anadir ${vegetables}, empezando por chayote y zanahoria y dejando la calabacita para el final; incorporar la salsa preparada si la receta tiene sus ingredientes.`);
    if (has(/^garbanzos/)) steps.push(`Incorporar ${take(/^garbanzos/)} ya cocidos y dejar que se calienten en el caldo.`);
    steps.push('Continuar la coccion hasta que las verduras esten tiernas; comprobar 74 C para pollo, 63 C y 3 minutos de reposo para bistec, o 63 C para pescado.');
  } else if (/^calabacitas rellenas/.test(name)) {
    source = reference('cheese-stuffed-zucchini');
    const squash = take(/^calabacita$/);
    steps.push(`Lavar ${squash}, cortar a lo largo y retirar parte de la pulpa con una cuchara; cocer las mitades 3 minutos en agua hirviendo y escurrir.`);
    const meat = take(/^carne molida/);
    const cheese = take(/^queso /);
    const corn = take(/^elote/);
    if (meat) steps.push(`Cocinar ${meat} ${pan} con la pulpa picada hasta alcanzar 71 C; incorporar ${corn || 'la pulpa restante'} y retirar del fuego.`);
    if (has(/^chile poblano/)) {
      const poblano = take(/^chile poblano/);
      steps.push(`Asar ${poblano}, cubrir 10 minutos, pelar y retirar semillas; licuar con agua y hervir 5 minutos para obtener el caldo.`);
    } else tomatoSauce();
    steps.push(`Rellenar las mitades con ${[meat && 'el picadillo cocido', cheese].filter(Boolean).join(' y ')}; colocar en la salsa y tapar a fuego bajo hasta que la calabacita este tierna y el relleno caliente.`);
  } else if (/^chiles rellenos/.test(name)) {
    source = reference('chiles-rellenos-de-picadillo');
    const poblano = take(/^chile poblano/);
    steps.push(`Asar ${poblano} girandolo hasta ampollar la piel; cubrir 10 minutos, pelar y abrir por un costado para retirar venas y semillas.`);
    const meat = take(/^carne molida/);
    const cheese = take(/^queso /);
    const corn = take(/^elote/);
    if (meat) steps.push(`Cocinar ${meat} ${pan} hasta alcanzar 71 C; ${corn ? `agregar ${corn} cocido y mezclar` : 'deshacer los grumos con una cuchara'}.`);
    tomatoSauce();
    steps.push(`Rellenar los chiles con ${[meat && 'la carne cocida', cheese, !meat && corn].filter(Boolean).join(' y ')}; calentar tapados en la salsa, sin capear ni agregar harina o huevo.`);
  } else if (/^tortitas/.test(name)) {
    source = reference('how-to-cook-huauzontles-recipe');
    const vegetables = take(vegetable);
    steps.push(`Lavar y picar ${vegetables}; cocer al vapor las verduras firmes y escurrir muy bien.${has(/^calabacita/) ? ' Exprimir la calabacita rallada.' : ''}${has(/^huauzontles/) ? ' Retirar los tallos gruesos y cocer solo los brotes tiernos de huauzontle de 8 a 10 minutos.' : ''}`);
    fish();
    const binders = take(/^(avena|huevo|queso)/);
    steps.push(`Mezclar las verduras${has(/^atun fresco/) ? ' y el atun cocido' : ''} con ${binders}; reposar de 10 a 15 minutos para que la avena absorba humedad.`);
    steps.push(`Formar tortitas pequenas y delgadas, sin agregar harina ni otros ingredientes; dorar ${pan} a fuego medio-bajo por ambos lados hasta que esten firmes.`);
    steps.push(has(/^huevo/) ? 'Comprobar que el centro alcance 71 C y que el huevo no quede liquido; servir calientes.' : 'Si la mezcla sin huevo se desmorona, cocinarla en montoncitos dentro de aros en lugar de anadir otro aglutinante.');
  } else if (/^(mixiotes|pollo en pipian|pollo almendrado|pollo encacahuatado)/.test(name)) {
    source = reference(/pipian/.test(name) ? 'pork-in-green-pipian-sauce' : /encacahuatado/.test(name) ? 'encacahuatado-puerco-pork-tenderloin' : /almendrado/.test(name) ? 'beef-tongue-in-almond-sauce' : 'how-to-make-adobo-sauce');
    const nuts = take(/^(semillas de calabaza|cacahuates|almendras)/);
    if (nuts) steps.push(`Tostar ${nuts} en sarten seca a fuego bajo, moviendo para no quemar; reservar para licuar con la salsa.`);
    tomatoSauce();
    if (nuts) steps.push('Licuar las semillas o frutos secos tostados con la salsa y agua suficiente para una consistencia fluida; hervir a fuego bajo, moviendo para evitar que se pegue.');
    if (/mixiotes/.test(name)) {
      const meat = take(/^carne molida/);
      const nopales = take(/^nopal/);
      steps.push(`Dividir ${meat} y ${nopales} picados en paquetes de papel para hornear apto para vapor; agregar la salsa y cerrar sin que se salga el liquido.`);
      steps.push('Cocinar en vaporera tapada, sin que los paquetes toquen el agua, hasta que el centro de la carne alcance 71 C; abrir con cuidado por el vapor.');
    } else {
      chicken();
      steps.push('Agregar el pollo cocido a la salsa y cocinar a fuego bajo de 8 a 10 minutos; mover y humedecer con su caldo si espesa demasiado.');
    }
  } else if (/^lasa/.test(name)) {
    source = reference('cheese-stuffed-zucchini');
    const squash = take(/^calabacita/);
    const meat = take(/^carne molida/);
    const lentils = take(/^lentejas/);
    const cheese = take(/^queso/);
    steps.push(`Cortar ${squash} en laminas y cocinarlas brevemente en comal; escurrir para evitar exceso de agua.`);
    steps.push(`Cocinar ${meat} ${pan} hasta 71 C; mezclar con ${take(/^pure de tomate/)} y ${lentils} ya cocidas, y hervir 5 minutos.`);
    steps.push(`Alternar capas de calabacita, relleno y ${cheese} en un refractario; hornear a 180 C hasta que el centro alcance 74 C.`);
  } else if (/^rollo de carne/.test(name)) {
    source = reference('mexican-meatloaf-recipe');
    const meat = take(/^carne molida/);
    const vegetables = take(/^(chicharos|espinaca|zanahoria)/);
    steps.push(`Cocer ${vegetables} hasta ablandar, escurrir y picar; extender ${meat} sobre papel para hornear formando un rectangulo uniforme.`);
    steps.push('Distribuir las verduras sobre la carne, enrollar con ayuda del papel y colocar la union hacia abajo en un molde.');
    steps.push(`Cubrir con ${take(/^pure de tomate/)} y hornear a 180 C hasta que el centro de la carne alcance 71 C; reposar antes de cortar.`);
  } else if (/^(huevo|huevos|omelette|tostada de huevo)/.test(name)) {
    source = reference(/motulenos/.test(name) ? 'huevos-motulenos-eggs-motul-style-recipe' : 'mexican-style-scrambled-eggs');
    const eggs = take(/^huevo /);
    const extra = take(/^(jamon|pechuga de pavo|espinaca|cebolla|jitomate|chile \(todo tipo\))/);
    const cheese = take(/^queso/);
    if (/ahogados/.test(name)) {
      steps.push(`Picar ${extra} y cocinar ${pan}; agregar agua, licuar y dejar que la salsa hierva suavemente.`);
      steps.push(`Abrir ${eggs} uno a uno sobre la salsa; tapar y cocinar hasta que claras y yemas esten firmes.`);
    } else if (/omelette/.test(name)) {
      steps.push(`Saltear ${extra} ${pan}; batir ${eggs} y verter en sarten a fuego bajo.`);
      steps.push(`Agregar ${cheese}, doblar la tortilla de huevo y continuar hasta que el huevo este firme y el centro alcance 71 C.`);
    } else {
      if (extra) steps.push(`Picar ${extra} y saltear ${pan} hasta que las verduras esten tiernas.`);
      steps.push(`Cocinar ${eggs} ${extra ? 'en esa sarten' : pan}, revueltos o enteros segun el platillo, hasta que claras y yemas esten firmes; para revueltos comprobar 71 C.`);
      if (cheese) steps.push(`Anadir ${cheese} al huevo ya cocido y calentar suavemente.`);
    }
    if (/motulenos/.test(name)) steps.push(`Calentar ${take(/^tortillas/)} en comal, colocar encima el huevo y los vegetales cocidos; no agregar frijoles, jamon ni otros ingredientes que no figuren en la receta.`);
    if (/tostada de huevo/.test(name)) steps.push(`Tostar ${take(/^pan /)} sin grasa adicional, cubrir con ${take(/^aguacate/)} machacado y colocar el huevo cocido encima.`);
  } else if (/^(chapata|sandwich|envueltos de atun|envueltos de lechuga|burrito)/.test(name)) {
    source = reference(/atun/.test(name) ? 'chipotle-tuna-sandwich' : 'quick-grilled-chicken-dinner-a-la-plancha');
    chicken();
    fish();
    const meat = take(/^carne molida/);
    if (meat) steps.push(`Cocinar ${meat} ${pan} con ${take(/^(zanahoria|pure de tomate)/)} hasta que la carne alcance 71 C y las verduras esten tiernas.`);
    const cold = take(/^(jamon|queso|aguacate|lechuga|jitomate)/);
    steps.push(`Lavar y desinfectar los vegetales de consumo crudo; cortar ${cold} para el relleno, manteniendolos separados de los alimentos crudos de origen animal.`);
    const bread = take(/^(pan |tortillas)/);
    steps.push(`${bread ? `Calentar ${bread} sin grasa adicional y repartir el relleno` : 'Usar las hojas de lechuga limpias como envoltura y repartir el relleno'}; incorporar la proteina cocida, cerrar o enrollar y servir. No usar atun fresco crudo.`);
  } else if (/^(pan |licuado|avena con)/.test(name)) {
    source = /avena con/.test(name) ? 'https://www.bbcgoodfood.com/recipes/perfect-porridge' : reference('quick-easy-banana-smoothie');
    const milk = take(/^leche/);
    const protein = take(/^proteina/);
    const bread = take(/^pan /);
    const spread = take(/^crema de cacahuate/);
    const nuts = take(/^nueces/);
    if (/avena con/.test(name)) {
      steps.push(`Cocinar ${take(/^avena/)} con ${milk} a fuego bajo, moviendo hasta que los copos esten suaves; agregar agua si hace falta, sin aumentar la leche indicada.`);
      steps.push(`Retirar del fuego e incorporar ${[spread, nuts].filter(Boolean).join(' y ')}; servir la porcion registrada.`);
    } else {
      if (bread) steps.push(`Tostar o calentar ${bread} ${oil ? `con el ${oil} medido` : 'sin agregar grasa'}; ${spread ? `untar ${spread}` : 'porcionar de acuerdo con la cantidad indicada'}.`);
      if (protein) steps.push(`Mezclar o licuar ${milk} con ${protein} hasta disolver; no anadir fruta, azucar ni otra leche.`);
      else if (milk) steps.push(`Servir ${milk} como bebida aparte.`);
      if (nuts) steps.push(`Acompanar con ${nuts} en la cantidad indicada.`);
      if (/mermelada/.test(name) && !has(/^mermelada/)) steps.push('La mermelada del nombre no figura en los ingredientes verificados; no agregarla ni sustituir otro alimento por ella.');
    }
  } else if (/^crema de verduras/.test(name)) {
    source = reference('zucchini-soup-recipe');
    const vegetables = take(vegetable);
    steps.push(`Lavar y cortar ${vegetables}; cocer en agua suficiente para cubrir hasta que esten suaves.`);
    steps.push(`Licuar las verduras con ${take(/^leche/)} y un poco de su agua; regresar a la olla y calentar suavemente con ${oil || 'su propio liquido'}, sin agregar crema ni harina.`);
    steps.push('Mover hasta que la crema este caliente y uniforme; evitar que se pegue al fondo.');
  } else if (/^sopa de conchita/.test(name)) {
    source = reference('mexican-pasta-soup-sopa-de-pasta');
    chicken();
    tomatoSauce();
    steps.push(`Cocer ${take(/^zanahoria/)} en la salsa diluida con el caldo del pollo hasta que este tierna.`);
    steps.push(`Agregar ${take(/^pasta cocida/)} ya cocida y medida y el pollo deshebrado; hervir suavemente solo hasta calentar, sin volver a freir la pasta cocida.`);
  } else if (/^(chilaquiles|enchiladas|quesadillas)/.test(name)) {
    source = reference(/chilaquiles/.test(name) ? 'chilaquiles-verdes-with-chicken' : /quesadillas/.test(name) ? 'squash-blossoms-quesadillas' : 'red-enchiladas-recipe');
    chicken();
    const vegetables = take(/^(zanahoria|calabacita|champi|coliflor|flor de calabaza|cebolla)/);
    if (vegetables) steps.push(`Picar ${vegetables}; cocer las verduras firmes y saltear ${pan} hasta ablandar, sin dejar exceso de liquido.`);
    const sauce = take(/^(salsa verde o roja|pure de tomate)/);
    if (sauce) steps.push(`Calentar ${sauce} a fuego bajo; si esta muy espesa, aligerar con agua, sin agregar mas aceite.`);
    const cheese = take(/^queso/);
    const base = take(/^(tortillas|totopos)/);
    steps.push(/chilaquiles/.test(name)
      ? `Agregar ${base} a la salsa caliente al momento de servir y colocar el pollo encima para que no se deshagan.`
      : `Calentar ${base} en comal; rellenar con ${[cheese, /pollo/.test(name) && 'el pollo cocido', vegetables && 'las verduras cocidas'].filter(Boolean).join(', ')} y doblar o enrollar. ${sauce ? 'Banar con la salsa caliente.' : 'Calentar tapado a fuego bajo para ablandar el queso panela.'}`);
  } else if (/^(chayote relleno|coliflor y brocoli)/.test(name)) {
    source = reference('cheese-stuffed-zucchini');
    const vegetables = take(vegetable);
    const filling = take(/^(jamon|queso)/);
    steps.push(`Cocer ${vegetables} al vapor o en agua hasta que esten tiernos; escurrir. Si es chayote, partir a la mitad y retirar la semilla.`);
    steps.push(`Distribuir ${filling} picados sobre las verduras o dentro de las mitades de chayote; calentar ${pan} a fuego bajo y tapado hasta que todo este bien caliente.`);
  } else if (/^(pollo con rajas|tostadas de pollo con rajas|tostadas de calabacitas)/.test(name)) {
    source = reference('roasted-poblano-pepper');
    const poblano = take(/^chile poblano/);
    steps.push(`Asar ${poblano}, cubrir 10 minutos, pelar, retirar semillas y cortar en rajas.`);
    chicken();
    const vegetables = take(/^(cebolla|calabacita)/);
    steps.push(`Cortar ${vegetables} y cocinar ${pan}; incorporar las rajas y, si corresponde, el pollo cocido y deshebrado.`);
    const dairy = take(/^(queso|yogurt)/);
    if (dairy) steps.push(`Retirar del fuego y agregar ${dairy}; mezclar sin hervir el yogurt, si lo hay.`);
    if (has(/^tostadas/)) steps.push(`Distribuir la preparacion sobre ${take(/^tostadas/)} justo antes de servir.`);
  } else if (/^tostadas de tinga/.test(name)) {
    source = reference('chicken-tinga-recipe');
    chicken();
    steps.push(`Cortar ${take(/^cebolla/)} en tiras y ${take(/^jitomate/)} en cubos; cocinar con un poco de agua a fuego bajo hasta que formen una salsa jugosa.`);
    steps.push('Anadir el pollo deshebrado y hervir suavemente de 8 a 10 minutos; no agregar chipotle ni aceite si no estan registrados.');
    steps.push(`Lavar y desinfectar ${take(/^col/)}; cortar finamente y colocar sobre ${take(/^tostadas/)} con el pollo caliente y ${take(/^aguacate/)}.`);
  } else if (/^(salmas|sopes)/.test(name)) {
    source = reference('sopes-recipe');
    const meat = take(/^carne molida/);
    steps.push(`Cocinar ${meat} ${pan} con ${take(/^(jitomate|cebolla|zanahoria|calabacita)/)} picados hasta que la carne alcance 71 C y las verduras esten tiernas.`);
    if (has(/^nopal/)) steps.push(`Limpiar ${take(/^nopal/)}, cortar a la medida y asar en comal hasta que este tierno; usar como base, sin agregar masa.`);
    if (has(/^salmas/)) steps.push(`Repartir el picadillo sobre ${take(/^salmas/)} al momento de servir.`);
    const toppings = take(/^(lechuga|salsa verde o roja|aguacate)/);
    if (toppings) steps.push(`Agregar ${toppings}; lavar y desinfectar previamente las hojas que se consumen crudas.`);
  } else if (/^(bistec|tacos de bistec)/.test(name)) {
    source = reference(/mexicana/.test(name) ? 'bistec-a-la-mexicana-recipe' : 'mexican-steak-tacos-recipe');
    const meat = take(/^bistec/);
    const vegetables = take(/^(jitomate|cebolla|chile \(todo tipo\)|cilantro|nopal)/);
    steps.push(`Picar ${vegetables}; si hay nopal, asarlo aparte hasta ablandar. Mantener el cilantro y el pico de gallo crudos separados de la carne.`);
    steps.push(`Cortar ${meat} y cocinar ${pan} hasta 63 C; reposar 3 minutos antes de servir. ${/mexicana/.test(name) ? 'Guisar con jitomate, cebolla y chile hasta que suelten sus jugos.' : 'Servir los vegetales como guarnicion.'}`);
    if (/quesadillas/.test(name)) steps.push(`Calentar ${take(/^tortillas/)} en comal y rellenar con ${take(/^queso/)}; doblar y calentar tapadas hasta que el queso este caliente.`);
    else steps.push(`Calentar ${take(/^tortillas/)} y rellenar con el bistec y los vegetales preparados.`);
  } else if (/^(tacos dorados|tacos de queso)/.test(name)) {
    source = reference('tacos-de-papa-potato-tacos-mex');
    const cheese = take(/^queso/);
    const carrot = take(/^zanahoria/);
    if (carrot) steps.push(`Rallar ${carrot}, cocerla brevemente al vapor y exprimir para retirar humedad.`);
    const base = take(/^tortillas/);
    steps.push(`Calentar ${base} para que sean flexibles; rellenar con ${[cheese, carrot && 'la zanahoria cocida'].filter(Boolean).join(' y ')} y doblar o enrollar.`);
    steps.push(/dorados/.test(name) ? `Dorar los tacos ${pan}, girandolos hasta que esten crujientes sin agregar mas aceite.` : `Calentar los tacos en comal y agregar ${take(/^(jitomate|cebolla)/)} picados como pico de gallo.`);
  } else if (/^(pescado empapelado)/.test(name)) {
    source = reference('easy-fish-fillets-dinner');
    const meat = take(/^pescado/);
    const topping = take(/^(jamon|queso|zanahoria)/);
    steps.push(`Colocar ${meat} sobre papel para hornear y distribuir ${topping} encima, con la zanahoria cortada muy fina.`);
    steps.push('Cerrar el paquete, colocar en charola y hornear a 180 C hasta que el pescado alcance 63 C; abrir con cuidado para no quemarse con el vapor.');
  } else if (/^(hamburguesa de salmon)/.test(name)) {
    source = 'https://www.bbcgoodfood.com/recipes/superhealthy-salmon-burgers';
    steps.push(`Retirar piel y espinas de ${take(/^salmon/)}; picar finamente y compactar en una hamburguesa sin agregar pan molido ni huevo.`);
    steps.push(`Refrigerar tapada 15 minutos para que mantenga su forma; cocinar ${pan} por ambos lados hasta alcanzar 63 C en el centro.`);
  } else if (/^(brochetas de camarones)/.test(name)) {
    source = reference('mexican-alambres-recipe');
    const shrimp = take(/^camaron/);
    const vegetables = take(/^(pimiento|cebolla|calabacita)/);
    steps.push(`Limpiar ${shrimp}, retirar la vena y cortar ${vegetables} en piezas pequenas de tamano semejante.`);
    steps.push('Ensartar alternando camarones y verduras en brochetas aptas para cocinar; remojar antes las de madera.');
    steps.push(`Cocinar las brochetas ${pan}, girando para coccion uniforme hasta que los camarones esten opacos y perlados; si las verduras necesitan mas tiempo, terminarlas por separado.`);
  } else if (/^(pescado al mojo|camarones al mojo|pescado blanco|pasta con|bowl de|tazon de|taco de salmon|tacos de camaron|tacos de pollo)/.test(name)) {
    source = reference(/mojo/.test(name) ? 'filete-de-pescado-al-mojo-de-ajo' : /camaron/.test(name) ? 'shrimp-mexican-style-ranchero-recipe' : 'quick-grilled-chicken-dinner-a-la-plancha');
    chicken();
    fish();
    if (has(/^camaron/)) steps.push(`Limpiar ${take(/^camaron/)}, retirar la vena y cocinar ${pan} hasta que la carne este opaca y perlada.`);
    const aromatics = take(/^(ajo|cebolla|perejil|pimienta)/);
    if (aromatics) steps.push(`Picar ${aromatics}; calentar suavemente ${pan} para liberar el aroma, sin quemar el ajo. Repartir el aceite indicado entre los pasos, sin duplicarlo.`);
    const vegetables = take(/^(jitomate|tomate$|pimiento|calabacita|brocoli|zanahoria|champi|acelga|espinaca|otras verduras|verduras)/);
    if (vegetables) steps.push(/crema de verduras/.test(name)
      ? `Cocer ${vegetables} en agua hasta ablandar; licuar con su agua y calentar para una crema sin leche ni harina, pues no figuran en esta receta.`
      : `Cortar ${vegetables} y cocinar al vapor o saltear con agua hasta que esten tiernos; incorporar la proteina cocida, salvo que se sirvan por separado.`);
    const extras = take(/^(surimi|salchicha|queso)/);
    if (extras) steps.push(`Cortar ${extras} e incorporar a la preparacion; calentar los productos precocidos siguiendo su etiqueta.`);
    const pasta = take(/^pasta cocida/);
    if (pasta) steps.push(`Mezclar ${pasta} ya cocida y medida con las verduras y la proteina; humedecer con agua de coccion y calentar.`);
    if (/tacos |taco de/.test(name)) steps.push(`Calentar ${take(/^tortillas/)} en comal y repartir la proteina; servir con los vegetales preparados.`);
    const sauces = take(/^(salsa|limon)/);
    if (sauces) steps.push(`Anadir ${sauces} en la cantidad indicada al momento de servir.`);
  } else {
    throw new Error(`No hay preparacion especifica para ${recipe.name}`);
  }

  const remaining = ingredients.filter((ingredient) => !used.has(ingredient.foodId));
  const fruit = remaining.filter((ingredient) => ingredient.group === 'Frutas');
  const sideVegetables = remaining.filter((ingredient) => ingredient.group === 'Verduras');
  if (sideVegetables.length) {
    const raw = sideVegetables.filter((ingredient) => /lechuga|col$|jitomate|tomate$|cilantro|perejil/.test(normalize(ingredient.name)));
    const cooked = sideVegetables.filter((ingredient) => !raw.includes(ingredient));
    if (cooked.length) steps.push(`Cocer al vapor ${[...new Set(cooked.map((ingredient) => ingredient.name))].join(', ')} hasta ablandar y reservar como guarnicion.`);
    if (raw.length) steps.push(`Lavar y desinfectar ${[...new Set(raw.map((ingredient) => ingredient.name))].join(', ')}; cortar y reservar para servir frescos.`);
  }
  const grains = remaining.filter((ingredient) => /arroz|frijoles|lentejas|garbanzos/.test(normalize(ingredient.name)));
  if (grains.length) steps.push(`Tener cocidos en agua ${grains.map((ingredient) => ingredient.name).join(', ')}; medir las porciones cocidas de la receta, sin sustituirlas por el mismo volumen en crudo, y calentar para servir.`);
  const sides = remaining.filter((ingredient) => ingredient.group !== 'Frutas').map((ingredient) => ingredient.name);
  if (sides.length || fruit.length) steps.push(`Acompanar con ${[...new Set([...sides, ...fruit.map((ingredient) => ingredient.name)])].join(', ')} en las cantidades indicadas${fruit.length ? '; servir la fruta aparte, lavada y cortada, sin incorporarla al guiso' : ''}.`);
  return { instructions: steps, sources: [source, 'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures'] };
}

module.exports = { preparationFor };