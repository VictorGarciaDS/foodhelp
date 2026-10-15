import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { AddRegular, DocumentRegular, PrintRegular, ShoppingBagRegular, WarningRegular } from '@fluentui/react-icons';
import { mealTimes, type Person } from '@foodhelp/contracts';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { GeneratedShoppingList, RecipeSummary } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

type MealTime = (typeof mealTimes)[number];
type MenuDay = { key: string; meals: Record<MealTime, string> };
const emptyMeals = (): Record<MealTime, string> => ({ Desayuno: '', Almuerzo: '', Comida: '', Cena: '' });
const createDay = (): MenuDay => ({ key: crypto.randomUUID(), meals: emptyMeals() });
const amountForDisplay = (value: string) => value.replace('/', ' / ');

export function ShoppingPage() {
  const { data: people, busy: peopleBusy, error: peopleError } = useResource<Person[]>(() => api.listPeople(), 0);
  const { data: recipes, busy: recipesBusy, error: recipesError } = useResource<RecipeSummary[]>(() => api.listRecipes(), 0);
  const [menuDays, setMenuDays] = useState<MenuDay[]>([createDay()]);
  const [personId, setPersonId] = useState('');
  const [peopleCount, setPeopleCount] = useState('1');
  const [result, setResult] = useState<GeneratedShoppingList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableRecipes = (recipes ?? []).filter((recipe) => recipe.verifiedAt !== null && recipe.personId !== null && recipe.mealTime !== null);

  useEffect(() => {
    if (!people?.length) { setPersonId(''); return; }
    setPersonId((current) => people.some((person) => person.id === current) ? current : people[0].id);
  }, [people]);

  const allMealsSelected = menuDays.length > 0 && menuDays.every((day) => mealTimes.every((mealTime) => Boolean(day.meals[mealTime])));
  const canCalculate = Boolean(personId) && allMealsSelected && Number.isInteger(Number(peopleCount)) && Number(peopleCount) >= 1 && Number(peopleCount) <= 31 && !busy;

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
      const meals = mealTimes.map((mealTime) => ({ mealTime, recipeIds: menuDays.map((day) => day.meals[mealTime]) }));
      setResult(await api.calculateShopping({ days: menuDays.length, peopleCount: Number(peopleCount), participants: [{ personId, meals }] }));
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
            <SectionHeading detail="Los platillos no se repiten en días consecutivos">Días de menú</SectionHeading>
            <Field label="Días por platillo" required><Input type="number" min="1" max="3" step="1" value={String(menuDays.length)} onChange={(_event, value) => resizeMenuDays(Number(value.value))} required /></Field>
            <Field label="Personas a la mesa" required><Input type="number" min="1" max="31" step="1" value={peopleCount} onChange={(_event, value) => { setPeopleCount(value.value); setResult(null); }} required /></Field>
            <Field label="Perfil del menú" required><Select value={personId} onChange={(event) => { setPersonId(event.currentTarget.value); setMenuDays((current) => current.map((day) => ({ ...day, meals: emptyMeals() }))); setResult(null); }} required><option value="" disabled>Seleccionar perfil</option>{(people ?? []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
          </div>
          {menuDays.map((day, dayIndex) => <Card appearance="outline" className="shopping-participant" key={day.key}>
            <div className="shopping-planner-heading"><SectionHeading detail={dayIndex === 0 ? 'Elige un platillo para cada comida' : `No repite la selección del día ${dayIndex}`}>Día {dayIndex + 1}</SectionHeading></div>
            <div className="shopping-meal-grid">{mealTimes.map((mealTime) => {
              const previousId = dayIndex ? menuDays[dayIndex - 1].meals[mealTime] : '';
              const options = availableRecipes.filter((recipe) => recipe.personId === personId && recipe.mealTime === mealTime && recipe.id !== previousId);
              return <section className="shopping-meal" key={`${day.key}-${mealTime}`}>
                <Field label={mealTime} required><Select value={day.meals[mealTime]} onChange={(event) => updateMeal(day.key, mealTime, event.currentTarget.value)} required><option value="" disabled>Seleccionar platillo</option>{options.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</Select></Field>
                {!options.length && <p className="shopping-no-recipes">{previousId ? 'No hay otra receta verificada disponible para evitar repetir.' : <>Sin recetas verificadas. <Link to="/recipes">Agrega una receta</Link>.</>}</p>}
              </section>;
            })}</div>
          </Card>)}
          <div className="shopping-planner-actions"><Button type="button" icon={<AddRegular />} disabled={menuDays.length >= 3} onClick={() => resizeMenuDays(menuDays.length + 1)}>Añadir día ({menuDays.length}/3)</Button><Button type="submit" appearance="primary" icon={<ShoppingBagRegular />} disabled={!canCalculate}>{busy ? 'Calculando...' : 'Calcular lista de compras'}</Button></div>
          {!availableRecipes.length && <Card appearance="outline" className="shopping-blocked"><WarningRegular /><p>Aún no hay recetas verificadas con ingredientes estructurados. Los borradores no se cuentan como recetas planificables. Edita una receta, ingresa cantidades por persona y verifica que coincida con la prescripción.</p></Card>}
        </section>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <section className="content-section shopping-results">
        <div className="shopping-planner-heading"><SectionHeading detail={`${result.days} días · ${result.peopleCount} personas`}>Lista consolidada</SectionHeading><div className="action-row action-row-start"><Button icon={<PrintRegular />} disabled={!result.items.length} onClick={() => window.print()}>Imprimir</Button><Button icon={<DocumentRegular />} disabled title="PDF de esta lista estará disponible después">PDF</Button></div></div>
        <p className="field-note">Las cantidades incluyen a todos los comensales. Las verduras libres sin medida física se cuentan como porciones de receta.</p>
        {result.items.length ? <Card appearance="outline" className="table-frame"><Table aria-label="Lista de compras calculada"><TableHeader><TableRow><TableHeaderCell>Alimento</TableHeaderCell><TableHeaderCell>Cantidad total</TableHeaderCell><TableHeaderCell>Unidad</TableHeaderCell><TableHeaderCell>Compra</TableHeaderCell></TableRow></TableHeader><TableBody>{result.items.map((item) => <TableRow key={`${item.foodId}-${item.unit}`}><TableCell>{item.name}</TableCell><TableCell>{amountForDisplay(item.quantity)}</TableCell><TableCell>{item.unit}</TableCell><TableCell>{item.purchaseOptions.length ? item.purchaseOptions.map((option) => `${option.quantity} ${option.unitName} (${amountForDisplay(option.contents)} ${option.unit})`).join(' · ') : '—'}</TableCell></TableRow>)}</TableBody></Table></Card> : <Card appearance="outline" className="empty-inline"><ShoppingBagRegular /><strong>La selección no requiere ingredientes medidos</strong><span>Los ingredientes libres sin cantidad física no se pueden sumar a la compra.</span></Card>}
      </section>}
    </PageFrame>
  );
}