import { useState } from 'react';
import { Button, Card, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, MessageBar, MessageBarBody, Select, Textarea } from '@fluentui/react-components';
import { AddRegular, BookmarkRegular, DeleteRegular, DismissRegular, EditRegular, EyeRegular, SaveRegular } from '@fluentui/react-icons';
import { foodGroups, freeFoodGroups, mealTimes, type Food, type FoodGroup, type Person, type RecipeEdit } from '@foodhelp/contracts';
import { api } from '../api';
import type { RecipeDetail, RecipeIngredient, RecipeMatch, RecipeSummary } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

type MainIngredientRow = { key: string; group: FoodGroup | ''; foodId: string };

export function RecipesPage() {
  const [retryKey, setRetryKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<RecipeEdit | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [discoveryPersonId, setDiscoveryPersonId] = useState('');
  const [discoveryMealTime, setDiscoveryMealTime] = useState<(typeof mealTimes)[number]>('Comida');
  const [mainIngredients, setMainIngredients] = useState<MainIngredientRow[]>([]);
  const [matches, setMatches] = useState<RecipeMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryAction, setDiscoveryAction] = useState<'search' | 'generate' | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const { data, busy, error } = useResource<RecipeSummary[]>(() => api.listRecipes(), retryKey);
  const { data: foods } = useResource<Food[]>(() => api.listFoods(), 0);
  const { data: people } = useResource<Person[]>(() => api.listPeople(), 0);
  const recipes = data ?? [];
  const activeDiscoveryPerson = people?.find((person) => person.id === discoveryPersonId) ?? people?.[0];
  const pageState = error ? 'error' : busy ? 'loading' : 'data';
  const { data: detail, busy: detailBusy, error: detailError, reload: reloadDetail } = useResource<RecipeDetail | null>(() => selectedId ? api.getRecipe(selectedId) : Promise.resolve(null), `${selectedId ?? ''}:${retryKey}`);
  const prescriptionPersonId = editor?.personId ?? detail?.personId ?? '';
  const { data: prescriptions, busy: prescriptionsBusy, error: prescriptionsError } = useResource(
    () => prescriptionPersonId ? api.listPrescriptions(prescriptionPersonId) : Promise.resolve([]),
    prescriptionPersonId,
  );
  const currentPrescription = prescriptions?.[0];
  const prescribedGroups = currentPrescription?.meals.filter((meal) => meal.mealTime === editor?.mealTime).map((meal) => meal.group) ?? [];
  const missingGroups = [...new Set(prescribedGroups)].filter((group) => !editor?.ingredients.some((ingredient) => ingredient.group === group));
  const mainFoodIds = mainIngredients.map((ingredient) => ingredient.foodId).filter(Boolean);
  const mainIngredientsComplete = mainIngredients.length > 0 && mainIngredients.every((ingredient) => ingredient.group && ingredient.foodId)
    && new Set(mainFoodIds).size === mainFoodIds.length;
  const canVerify = Boolean(editor && currentPrescription && !prescriptionsBusy && !prescriptionsError
    && missingGroups.length === 0 && editor.reviewNotes.length === 0 && editor.ingredients.length > 0
    && editor.instructions.length > 0 && editor.instructions.every((instruction) => instruction.trim().length > 0));

  function startEditing(recipe: RecipeDetail) {
    setCreating(false);
    setEditorError(null);
    setEditor({
      personId: recipe.personId ?? people?.[0]?.id ?? '',
      name: recipe.name,
      mealTime: (mealTimes as readonly string[]).includes(recipe.mealTime ?? '') ? recipe.mealTime as RecipeEdit['mealTime'] : 'Desayuno',
      sourceText: recipe.sourceText ?? '',
      reviewNotes: recipe.reviewNotes ?? [],
      instructions: recipe.instructions ?? [],
      ingredients: recipe.ingredients ?? [],
      verify: Boolean(recipe.verifiedAt),
    });
  }

  function startCreating() {
    const personId = people?.[0]?.id;
    if (!personId) return;
    setEditorError(null);
    setSelectedId(null);
    setCreating(true);
    setEditor({ personId, name: '', mealTime: 'Desayuno', sourceText: '', reviewNotes: [], instructions: [], ingredients: [], verify: false });
  }

  function updateIngredient(index: number, changes: Partial<RecipeIngredient>) {
    setEditor((current) => current && ({
      ...current,
      verify: false,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) => ingredientIndex === index ? { ...ingredient, ...changes } : ingredient),
    }));
  }

  function selectFood(index: number, foodId: string) {
    const food = foods?.find((item) => item.id === foodId);
    if (!food) return;
    const free = food.isFreeConsumption;
    updateIngredient(index, {
      foodId,
      group: food.group,
      isFreeConsumption: free,
      quantity: free ? null : '1',
      unit: free ? null : food.unit,
    });
  }

  function selectFoodGroup(index: number, group: FoodGroup) {
    const isFreeConsumption = (freeFoodGroups as readonly string[]).includes(group);
    updateIngredient(index, { foodId: '', group, isFreeConsumption, quantity: null, unit: null });
  }

  async function saveEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setEditorError(null);
    setSaving(true);
    try {
      const saved = creating ? await api.createRecipe(editor) : selectedId ? await api.updateRecipe(selectedId, editor) : null;
      if (!saved) return;
      setEditor(null);
      setCreating(false);
      setSelectedId(saved.id);
      setRetryKey((value) => value + 1);
      reloadDetail();
    } catch (caught) {
      setEditorError(caught instanceof Error ? caught.message : 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  }

  async function findMatches(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDiscoveryPerson || !mainIngredientsComplete) return;
    setDiscoveryBusy(true);
    setDiscoveryAction('search');
    setDiscoveryError(null);
    setDiscoveryMessage(null);
    setHasSearched(true);
    setMatches([]);
    try {
      const result = await api.findRecipeMatches({ personId: activeDiscoveryPerson.id, mealTime: discoveryMealTime, mainFoodIds });
      setMatches(result);
    } catch (caught) {
      setDiscoveryError(caught instanceof Error ? caught.message : 'No se pudieron buscar recetas.');
    } finally {
      setDiscoveryBusy(false);
      setDiscoveryAction(null);
    }
  }

  async function generateRecipes() {
    if (!activeDiscoveryPerson || !mainIngredientsComplete) return;
    setDiscoveryBusy(true);
    setDiscoveryAction('generate');
    setDiscoveryError(null);
    setDiscoveryMessage(null);
    try {
      const generated = await api.generateRecipes({ personId: activeDiscoveryPerson.id, mealTime: discoveryMealTime, mainFoodIds });
      setRetryKey((value) => value + 1);
      setMatches([]);
      setDiscoveryMessage(`Se guardaron ${generated.length} receta(s) con equivalencias verificadas.`);
    } catch (caught) {
      setDiscoveryError(caught instanceof Error ? caught.message : 'No se pudieron generar recetas.');
    } finally {
      setDiscoveryBusy(false);
      setDiscoveryAction(null);
    }
  }

  return (
    <PageFrame
      title="Recetas"
      subtitle="Recetas guardadas primero · detalle bajo demanda"
      state={pageState}
      hasData={recipes.length > 0}
      error={error}
      onRetry={() => setRetryKey((value) => value + 1)}
      emptyTitle="Todavía no hay recetas guardadas"
      emptyText="Todavía no se han registrado propuestas familiares."
    >
      <section className="content-section">
        <div className="recipe-list-heading"><SectionHeading detail={`${recipes.length} propuestas`}>Recetas guardadas</SectionHeading><Button appearance="primary" icon={<AddRegular />} disabled={!people?.length} onClick={startCreating}>Añadir receta</Button></div>
        <div className="recipe-list">{recipes.map((recipe) => (
          <Card appearance="outline" key={recipe.id} className="recipe-row">
            <BookmarkRegular aria-hidden="true" />
            <div className="recipe-summary"><strong>{recipe.name}</strong><p>{recipe.personName ?? 'Sin persona asignada'} · {recipe.mealTime ?? 'Sin tiempo asignado'}</p><span className={`status-pill ${recipe.verifiedAt ? 'status-confirmed' : 'status-pending'}`}>{recipe.verifiedAt ? 'Verificada' : 'Borrador pendiente de revisión'}</span></div>
            <Button appearance="secondary" icon={<EyeRegular />} onClick={() => setSelectedId(recipe.id)}>Ver detalle</Button>
          </Card>
        ))}</div>
      </section>
      <section className="content-section recipe-discovery">
        <SectionHeading detail="Primero se buscan recetas ya guardadas">Buscar por antojo</SectionHeading>
        <form className="recipe-discovery-form" onSubmit={findMatches}>
          <Field label="Persona" required><Select value={activeDiscoveryPerson?.id ?? ''} onChange={(event) => { setDiscoveryPersonId(event.currentTarget.value); setMatches([]); setHasSearched(false); }} required>{(people ?? []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
          <Field label="Tiempo de comida" required><Select value={discoveryMealTime} onChange={(event) => { setDiscoveryMealTime(event.currentTarget.value as typeof discoveryMealTime); setMatches([]); setHasSearched(false); }}>{mealTimes.map((mealTime) => <option key={mealTime}>{mealTime}</option>)}</Select></Field>
          <fieldset className="main-food-picker" disabled={discoveryBusy}>
            <legend>Ingredientes principales</legend>
            {mainIngredients.map((ingredient, index) => (
              <div className="discovery-ingredient-row" key={ingredient.key}>
                <Field label={`Tipo de ingrediente ${index + 1}`} required><Select value={ingredient.group} onChange={(event) => { const group = event.currentTarget.value as FoodGroup | ''; setMainIngredients((current) => current.map((item) => item.key === ingredient.key ? { ...item, group, foodId: '' } : item)); setMatches([]); setHasSearched(false); }}><option value="">Seleccionar tipo</option>{foodGroups.map((group) => <option key={group} value={group}>{group === 'Proteinas' ? 'Proteínas' : group === 'Azucar' ? 'Azúcar' : group === 'Lacteos' ? 'Lácteos' : group}</option>)}</Select></Field>
                <Field label={`Alimento principal ${index + 1}`} required><Select value={ingredient.foodId} disabled={!ingredient.group} onChange={(event) => { const foodId = event.currentTarget.value; setMainIngredients((current) => current.map((item) => item.key === ingredient.key ? { ...item, foodId } : item)); setMatches([]); setHasSearched(false); }}><option value="">Seleccionar alimento</option>{(foods ?? []).filter((food) => food.group === ingredient.group && food.verifiedAt && !food.portionPending).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</Select></Field>
                <Button type="button" icon={<DeleteRegular />} aria-label={`Quitar ingrediente principal ${index + 1}`} title="Quitar ingrediente" onClick={() => { setMainIngredients((current) => current.filter((item) => item.key !== ingredient.key)); setMatches([]); setHasSearched(false); }} />
              </div>
            ))}
            <Button type="button" icon={<AddRegular />} onClick={() => { setMainIngredients((current) => [...current, { key: crypto.randomUUID(), group: '', foodId: '' }]); setMatches([]); setHasSearched(false); }}>Añadir ingrediente principal</Button>
            {mainIngredientsComplete && <p className="field-note">{mainFoodIds.length} ingrediente(s) seleccionados.</p>}
          </fieldset>
          <div className="recipe-discovery-actions"><Button type="submit" appearance="primary" icon={<EyeRegular />} disabled={!activeDiscoveryPerson || !mainIngredientsComplete || discoveryBusy}>{discoveryAction === 'search' ? 'Buscando...' : 'Buscar recetas guardadas'}</Button></div>
        </form>
        {discoveryError && <p className="form-error" role="alert">{discoveryError}</p>}
        {discoveryMessage && <p className="form-success" role="status">{discoveryMessage}</p>}
        {hasSearched && matches.length > 0 && <div className="recipe-match-list"><SectionHeading detail="Ordenadas por ingredientes principales en común">Coincidencias guardadas</SectionHeading>{matches.map((match) => <Card appearance="outline" className="recipe-row" key={match.id}><BookmarkRegular aria-hidden="true"/><div className="recipe-summary"><strong>{match.name}</strong><p>{match.personName} · {match.mealTime} · {match.matchCount} ingrediente(s) en común</p><span className={`status-pill ${match.verifiedAt ? 'status-confirmed' : 'status-pending'}`}>{match.verifiedAt ? 'Verificada' : 'Borrador pendiente'}</span></div><Button appearance="secondary" icon={<EyeRegular />} onClick={() => setSelectedId(match.id)}>Ver detalle</Button></Card>)}</div>}
        {hasSearched && matches.length === 0 && !discoveryError && <MessageBar intent="info"><MessageBarBody>No hay recetas guardadas que coincidan con esos ingredientes y ese tiempo de comida.</MessageBarBody></MessageBar>}
        {hasSearched && <div className="recipe-ai-action"><p>Si quieres una opción nueva, la IA propondrá tres recetas. Solo se guardarán las que respeten exactamente la prescripción, los alimentos elegidos y sus unidades.</p><Button appearance="secondary" icon={<AddRegular />} disabled={!activeDiscoveryPerson || !mainIngredientsComplete || discoveryBusy} onClick={generateRecipes}>{discoveryAction === 'generate' ? 'Generando y verificando...' : 'Generar 3 recetas nuevas'}</Button></div>}
      </section>
      <Dialog open={selectedId !== null || creating} onOpenChange={(_event, data) => { if (!data.open && !saving) { setSelectedId(null); setEditor(null); setCreating(false); } }}>
        <DialogSurface className="recipe-dialog"><DialogBody>
          <DialogTitle>{editor ? creating ? 'Nueva receta' : 'Editar receta' : recipes.find((recipe) => recipe.id === selectedId)?.name ?? 'Receta'}</DialogTitle>
          <DialogContent>
            {editor ? (
              <form id="recipe-editor" className="recipe-editor" onSubmit={saveEditor}>
                <Field label="Nombre" required><Input required maxLength={160} value={editor.name} onChange={(_event, value) => setEditor({ ...editor, name: value.value, verify: false })} /></Field>
                <Field label="Persona" required><Select value={editor.personId} onChange={(event) => setEditor({ ...editor, personId: event.currentTarget.value, verify: false })}>{(people ?? []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
                <Field label="Tiempo de comida" required><Select value={editor.mealTime} onChange={(event) => setEditor({ ...editor, mealTime: event.currentTarget.value as RecipeEdit['mealTime'], verify: false })}>{mealTimes.map((mealTime) => <option key={mealTime}>{mealTime}</option>)}</Select></Field>
                <Field label="Propuesta original" required><Textarea required resize="vertical" value={editor.sourceText} onChange={(_event, value) => setEditor({ ...editor, sourceText: value.value, verify: false })} /></Field>
                <Field label="Pendientes de revisión"><Textarea resize="vertical" placeholder="Una nota pendiente por línea; deja vacío para confirmar que se resolvieron." value={editor.reviewNotes.join('\n')} onChange={(_event, value) => setEditor({ ...editor, reviewNotes: value.value.split('\n').map((note) => note.trim()).filter(Boolean), verify: false })} /></Field>
                <section className="recipe-ingredients-editor">
                  <h3>Ingredientes por persona</h3>
                  <p>Las cantidades se registran por una ración de la receta y se suman sin convertir unidades.</p>
                  {editor.ingredients.map((ingredient, index) => (
                    <div className="recipe-ingredient-row" key={`${index}-${ingredient.foodId}`}>
                      <Field label={`Tipo de alimento ${index + 1}`} required><Select value={ingredient.group} onChange={(event) => selectFoodGroup(index, event.currentTarget.value as FoodGroup)}>{foodGroups.map((group) => <option key={group} value={group}>{group === 'Proteinas' ? 'Proteínas' : group === 'Azucar' ? 'Azúcar' : group === 'Lacteos' ? 'Lácteos' : group}</option>)}</Select></Field>
                      <Field label={`Alimento ${index + 1}`} required><Select value={ingredient.foodId} onChange={(event) => selectFood(index, event.currentTarget.value)}><option value="">Seleccionar alimento verificado</option>{(foods ?? []).filter((food) => food.group === ingredient.group && food.verifiedAt && !food.portionPending && food.isFreeConsumption === ingredient.isFreeConsumption).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</Select></Field>
                      {ingredient.isFreeConsumption ? <div className="free-purchase-fields"><p className="free-ingredient-label">Libre para equivalencias. Indica cantidad solo si quieres sumarla a compras.</p><Field label="Cantidad para compras"><Input placeholder="Ej. 2" value={ingredient.quantity ?? ''} onChange={(_event, value) => updateIngredient(index, { quantity: value.value || null })} /></Field><Field label="Unidad de compra"><Input placeholder="Ej. tazas" value={ingredient.unit ?? ''} onChange={(_event, value) => updateIngredient(index, { unit: value.value || null })} /></Field></div> : <Field label={`Cantidad (${ingredient.unit ?? 'unidad'})`} required><Input required placeholder="Ej. 1/2" value={ingredient.quantity ?? ''} onChange={(_event, value) => updateIngredient(index, { quantity: value.value || null, group: ingredient.group })} /></Field>}
                      <Button type="button" icon={<DeleteRegular />} aria-label={`Quitar ingrediente ${index + 1}`} title="Quitar ingrediente" onClick={() => setEditor({ ...editor, verify: false, ingredients: editor.ingredients.filter((_item, itemIndex) => itemIndex !== index) })} />
                    </div>
                  ))}
                  <Button type="button" icon={<AddRegular />} disabled={!foods?.some((food) => food.verifiedAt && !food.portionPending)} onClick={() => setEditor({ ...editor, verify: false, ingredients: [...editor.ingredients, { foodId: '', quantity: null, unit: null, group: 'Frutas', isFreeConsumption: false }] })}>Añadir ingrediente</Button>
                </section>
                <section className="recipe-steps-editor"><h3>Preparación</h3>{editor.instructions.map((instruction, index) => <div className="recipe-ingredient-row" key={index}><Field label={`Paso ${index + 1}`} required><Input required value={instruction} onChange={(_event, value) => setEditor({ ...editor, verify: false, instructions: editor.instructions.map((step, stepIndex) => stepIndex === index ? value.value : step) })} /></Field><Button type="button" icon={<DeleteRegular />} aria-label={`Quitar paso ${index + 1}`} title="Quitar paso" onClick={() => setEditor({ ...editor, verify: false, instructions: editor.instructions.filter((_step, stepIndex) => stepIndex !== index) })} /></div>)}<Button type="button" icon={<AddRegular />} onClick={() => setEditor({ ...editor, verify: false, instructions: [...editor.instructions, ''] })}>Añadir paso</Button></section>
                {prescriptionsError && <p role="alert" className="form-error">No se pudo cargar la prescripción del perfil seleccionado.</p>}
                {!prescriptionsBusy && !currentPrescription && <MessageBar intent="warning"><MessageBarBody>No hay una prescripción guardada para {editor.mealTime} en el perfil seleccionado.</MessageBarBody></MessageBar>}
                {missingGroups.length > 0 && <MessageBar intent="warning"><MessageBarBody>Falta añadir ingredientes de estos tipos prescritos: {missingGroups.map((group) => group === 'Proteinas' ? 'Proteínas' : group === 'Lacteos' ? 'Lácteos' : group).join(', ')}.</MessageBarBody></MessageBar>}
                {editor.reviewNotes.length > 0 && <MessageBar intent="warning"><MessageBarBody>Resuelve las notas pendientes antes de verificar esta receta.</MessageBarBody></MessageBar>}
                <Checkbox checked={editor.verify} disabled={!canVerify} onChange={(_event, value) => setEditor({ ...editor, verify: Boolean(value.checked) })} label="Verificar equivalencias contra la prescripción actual" />
                <p className="field-note">El servidor habilita la receta solo si cada tipo prescrito está presente y las cantidades suman exactamente.</p>
                {editorError && <p role="alert" className="form-error">{editorError}</p>}
              </form>
            ) : detailBusy ? <p role="status">Cargando receta...</p> : detailError ? <p role="alert" className="form-error">{detailError}</p> : detail && (
              <>
                <p>{detail.personName} · {detail.mealTime}</p>
                {!detail.verifiedAt && <MessageBar intent="warning"><MessageBarBody>Borrador no disponible en listas hasta completar ingredientes y verificar equivalencias.</MessageBarBody></MessageBar>}
                {detail.sourceText && <section><h3>Propuesta original</h3><p className="recipe-source">{detail.sourceText}</p></section>}
                <section><h3>Ingredientes por persona</h3>{detail.ingredients.length ? <ul>{detail.ingredients.map((ingredient, index) => <li key={index}>{ingredient.isFreeConsumption ? `Libre${ingredient.quantity && ingredient.unit ? ` · ${ingredient.quantity} ${ingredient.unit} para compras` : ''}` : `${ingredient.quantity} ${ingredient.unit}`} · {foods?.find((food) => food.id === ingredient.foodId)?.name ?? ingredient.foodId}</li>)}</ul> : <p>Ingredientes aún no estructurados.</p>}</section>
                {detail.reviewNotes.length > 0 && <section><h3>Pendientes de revisión</h3><ul>{detail.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></section>}
                {detail.instructions.length > 0 && <section><h3>Preparación</h3><ol>{detail.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol></section>}
              </>
            )}
          </DialogContent>
          <DialogActions>{editor ? <><Button disabled={saving} icon={<DismissRegular />} onClick={() => { setEditor(null); if (creating) setCreating(false); }}>Cancelar</Button><Button type="submit" form="recipe-editor" appearance="primary" disabled={saving} icon={<SaveRegular />}>{saving ? 'Guardando...' : 'Guardar receta'}</Button></> : <><Button icon={<EditRegular />} onClick={() => detail && startEditing(detail)}>Editar receta</Button><Button icon={<DismissRegular />} onClick={() => setSelectedId(null)}>Cerrar</Button></>}</DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </PageFrame>
  );
}