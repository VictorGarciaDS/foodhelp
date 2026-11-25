import { useState, type FormEvent } from 'react';
import { Button, Card, Field, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { AddRegular, DocumentRegular, ShoppingBagRegular, WarningRegular } from '@fluentui/react-icons';
import { canRepeatShoppingMeal, mainMealTimes, mealTimes, type Person } from '@foodhelp/contracts';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { GeneratedShoppingList, RecipeSummary, ShoppingPlan } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

type MealTime = (typeof mealTimes)[number];
type MenuDay = { key: string; meals: Record<MealTime, string> };
const emptyMeals = (): Record<MealTime, string> => ({ Desayuno: '', Almuerzo: '', Comida: '', Cena: '', Colacion: '' });
const createDay = (): MenuDay => ({ key: crypto.randomUUID(), meals: emptyMeals() });
const amountForDisplay = (value: string) => value.replace('/', ' / ');
const purchaseUnitForDisplay = (quantity: string, unit: string) => quantity === '1'
  ? ({ paquetes: 'paquete', docenas: 'docena', kilogramos: 'kilogramo', litros: 'litro', gramos: 'gramo', mililitros: 'mililitro' }[unit] ?? unit)
  : unit;

export function ShoppingPage() {
  const { data: people, busy: peopleBusy, error: peopleError } = useResource<Person[]>(() => api.listPeople(), 0);
  const { data: recipes, busy: recipesBusy, error: recipesError } = useResource<RecipeSummary[]>(() => api.listRecipes(), 0);
  const [menuDays, setMenuDays] = useState<MenuDay[]>([createDay()]);
  const [profileCounts, setProfileCounts] = useState<Record<string, string>>({});
  const [daysPerDish, setDaysPerDish] = useState('1');
  const [result, setResult] = useState<GeneratedShoppingList | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<ShoppingPlan | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableRecipes = (recipes ?? []).filter((recipe) => recipe.verifiedAt !== null && recipe.personId === null && recipe.mealTime !== null);
  const profiles = (people ?? []).map((person) => ({ ...person, count: profileCounts[person.id] ?? '1' }));
  const peopleCount = profiles.reduce((total, profile) => total + (Number.isFinite(Number(profile.count)) ? Number(profile.count) : 0), 0);
  const validCounts = profiles.length > 0 && profiles.every((profile) => profile.count.trim() !== '' && Number.isInteger(Number(profile.count)) && Number(profile.count) >= 0 && Number(profile.count) <= 31);

  const allMealsSelected = menuDays.length > 0 && menuDays.every((day) => mainMealTimes.every((mealTime) => Boolean(day.meals[mealTime])));
  const canCalculate = validCounts && peopleCount > 0 && allMealsSelected && !busy;

  function resizeMenuDays(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3) return;
    setMenuDays((current) => {
      const next = current.slice(0, count);
      while (next.length < count) next.push(createDay());
      return next;
    });
    setResult(null);
  }

  function updateMeal(dayKey: string, mealTime: MealTime, recipeId: string) {
    setMenuDays((current) => current.map((day) => day.key === dayKey ? { ...day, meals: { ...day.meals, [mealTime]: recipeId } } : day));
    setResult(null);
  }

  async function generateShopping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!canCalculate) {
      setError('Completa una receta por comida y día, y confirma el número de comensales.');
      return;
    }
    setBusy(true);
    try {
      const meals = mainMealTimes.map((mealTime) => ({ mealTime, recipeIds: menuDays.map((day) => day.meals[mealTime]) }));
      const plan: ShoppingPlan = { days: menuDays.length, daysPerDish: Number(daysPerDish), meals,
        participants: profiles.map((profile) => ({ personId: profile.id, peopleCount: Number(profile.count) })),
      };
      setResult(await api.calculateShopping(plan));
      setLastPlan(plan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo calcular la lista de compras.');
    } finally {
      setBusy(false);
    }
  }

  const loadError = peopleError ?? recipesError;
  const pageState = loadError ? 'error' : peopleBusy || recipesBusy ? 'loading' : 'data';

  return (
      <PageFrame title="Compras" subtitle="Una receta por comida y día, con cantidades para la mesa" state={pageState} hasData={true} error={loadError} onRetry={() => window.location.reload()} emptyTitle="No hay personas" emptyText="Registra una persona antes de crear una lista de compras.">
      <form className="shopping-planner" onSubmit={generateShopping}>
        <section className="content-section">
          <div className="shopping-planner-heading">
            <SectionHeading detail={`${menuDays.length * Number(daysPerDish)} días de compras`}>Menús distintos</SectionHeading>
            <Field label="Días por platillo" required><Select value={daysPerDish} onChange={(event) => { setDaysPerDish(event.currentTarget.value); setResult(null); }}><option value="1">1</option><option value="2">2</option><option value="3">3</option></Select></Field>
            <Field label="Menús distintos" required><Select value={String(menuDays.length)} onChange={(event) => resizeMenuDays(Number(event.currentTarget.value))}><option value="1">1</option><option value="2">2</option><option value="3">3</option></Select></Field>
          </div>
          <SectionHeading detail={`${peopleCount} personas`}>Personas a la mesa</SectionHeading>
          <div className="shopping-profiles">{profiles.map((profile) => <Field label={profile.name} key={profile.id} required><Input aria-label={`Personas a la mesa: ${profile.name}`} type="number" min="0" max="31" step="1" value={profile.count} onChange={(_event, value) => { setProfileCounts((current) => ({ ...current, [profile.id]: value.value })); setResult(null); }} required /></Field>)}</div>
          {menuDays.map((day, dayIndex) => <Card appearance="outline" className="shopping-participant" key={day.key}>
            <div className="shopping-planner-heading"><SectionHeading detail={`Días ${dayIndex * Number(daysPerDish) + 1} a ${(dayIndex + 1) * Number(daysPerDish)}`}>Menú {dayIndex + 1}</SectionHeading></div>
            <div className="shopping-meal-grid">{mainMealTimes.map((mealTime) => {
              const previousId = dayIndex && !canRepeatShoppingMeal(mealTime) ? menuDays[dayIndex - 1].meals[mealTime] : '';
              const options = availableRecipes.filter((recipe) => recipe.mealTime === mealTime && recipe.id !== previousId);
              return <section className="shopping-meal" key={`${day.key}-${mealTime}`}>
                <Field label={mealTime} required><Select value={day.meals[mealTime]} onChange={(event) => updateMeal(day.key, mealTime, event.currentTarget.value)} required><option value="" disabled>Seleccionar platillo</option>{options.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</Select></Field>
                {!options.length && <p className="shopping-no-recipes">{previousId ? 'No hay otra receta base verificada disponible para evitar repetir.' : <>Sin recetas base verificadas. <Link to="/recipes">Agrega una receta</Link>.</>}</p>}
              </section>;
            })}</div>
          </Card>)}
          <div className="shopping-planner-actions"><Button type="button" icon={<AddRegular />} disabled={menuDays.length >= 3} onClick={() => resizeMenuDays(menuDays.length + 1)}>Añadir menú ({menuDays.length}/3)</Button><Button type="submit" appearance="primary" icon={<ShoppingBagRegular />} disabled={!canCalculate}>{busy ? 'Calculando...' : 'Calcular lista de compras'}</Button></div>
          {!availableRecipes.length && <Card appearance="outline" className="shopping-blocked"><WarningRegular /><p>Aún no hay recetas verificadas con ingredientes estructurados. Los borradores no se cuentan como recetas planificables. Edita una receta, ingresa cantidades por persona y verifica que coincida con la prescripción.</p></Card>}
        </section>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <section className="content-section shopping-results">
        <div className="shopping-planner-heading"><SectionHeading detail={`${result.days} días · ${result.peopleCount} personas`}>Lista consolidada</SectionHeading><div className="action-row action-row-start"><Button icon={<DocumentRegular />} disabled={!lastPlan || !result.items.length || pdfBusy} onClick={async () => { if (!lastPlan) return; setPdfBusy(true); setError(null); try { await api.downloadShoppingPdf(lastPlan); } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo generar el PDF.'); } finally { setPdfBusy(false); } }}>{pdfBusy ? 'Generando PDF...' : 'PDF'}</Button></div></div>
        <div className="shopping-profile-summary">{result.participants.map((participant) => <span key={participant.personId}>{participant.personName ?? profiles.find((profile) => profile.id === participant.personId)?.name}: {participant.peopleCount ?? 1}</span>)}</div>
        {result.items.length ? <Card appearance="outline" className="table-frame"><Table aria-label="Lista de compras calculada"><TableHeader><TableRow><TableHeaderCell>Alimento</TableHeaderCell><TableHeaderCell>Cantidad total</TableHeaderCell><TableHeaderCell>Unidad</TableHeaderCell><TableHeaderCell>Compra</TableHeaderCell><TableHeaderCell>Dónde comprar</TableHeaderCell></TableRow></TableHeader><TableBody>{result.items.map((item) => <TableRow key={`${item.foodId}-${item.unit}`}><TableCell>{item.name}</TableCell><TableCell>{amountForDisplay(item.quantity)}</TableCell><TableCell>{item.unit}</TableCell><TableCell>{[...item.purchaseOptions.map((option) => `${option.quantity} ${purchaseUnitForDisplay(option.quantity, option.purchaseUnit)}${option.isApproximate ? ' aprox.' : ''} (${amountForDisplay(option.contents)} ${option.unit})`), ...(item.purchasePending ? ['Empaque por confirmar'] : [])].join(' · ') || '—'}</TableCell><TableCell>{item.purchaseLocation ?? 'Supermercado'}</TableCell></TableRow>)}</TableBody></Table></Card> : <Card appearance="outline" className="empty-inline"><ShoppingBagRegular /><strong>La selección no requiere ingredientes medidos</strong><span>Los ingredientes libres sin cantidad física no se pueden sumar a la compra.</span></Card>}
      </section>}
    </PageFrame>
  );
}