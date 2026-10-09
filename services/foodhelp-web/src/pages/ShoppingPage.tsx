import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Field, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { AddRegular, DocumentRegular, PrintRegular, ShoppingBagRegular, WarningRegular } from '@fluentui/react-icons';
import { mealTimes, type Person } from '@foodhelp/contracts';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { GeneratedShoppingList, RecipeSummary, ShoppingParticipant } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

type MealTime = (typeof mealTimes)[number];
type ParticipantDraft = { key: string; personId: string; days: string; meals: Record<MealTime, string[]> };
const emptyMeals = (): Record<MealTime, string[]> => ({ Desayuno: [], Almuerzo: [], Comida: [], Cena: [] });
const amountForDisplay = (value: string) => value.replace('/', ' / ');

export function ShoppingPage() {
  const { data: people, busy: peopleBusy, error: peopleError } = useResource<Person[]>(() => api.listPeople(), 0);
  const { data: recipes, busy: recipesBusy, error: recipesError } = useResource<RecipeSummary[]>(() => api.listRecipes(), 0);
  const [days, setDays] = useState('7');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [result, setResult] = useState<GeneratedShoppingList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableRecipes = (recipes ?? []).filter((recipe) => recipe.verifiedAt !== null && recipe.personId !== null && recipe.mealTime !== null);

  useEffect(() => {
    if (!people?.length) {
      setParticipants([]);
      return;
    }
    setParticipants((current) => {
      if (current.length) return current.map((participant) => people.some((person) => person.id === participant.personId)
        ? participant
        : { ...participant, personId: people[0].id, meals: emptyMeals() });
      return [{ key: crypto.randomUUID(), personId: people[0].id, days, meals: emptyMeals() }];
    });
  }, [people]);

  const allMealsSelected = participants.length > 0 && participants.every((participant) => mealTimes.every((mealTime) => participant.meals[mealTime].length > 0));
  const canGenerate = allMealsSelected && Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 31 && !busy;

  function updateParticipant(key: string, changes: Partial<ParticipantDraft>) {
    setParticipants((current) => current.map((participant) => participant.key === key ? { ...participant, ...changes } : participant));
    setResult(null);
  }

  function toggleRecipe(key: string, mealTime: MealTime, recipeId: string, checked: boolean) {
    setParticipants((current) => current.map((participant) => {
      if (participant.key !== key) return participant;
      const ids = participant.meals[mealTime];
      return { ...participant, meals: { ...participant.meals, [mealTime]: checked ? [...ids, recipeId] : ids.filter((id) => id !== recipeId) } };
    }));
    setResult(null);
  }

  async function generateShopping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!allMealsSelected) {
      setError('Selecciona al menos una receta de cada tiempo de comida para cada participante.');
      return;
    }
    setBusy(true);
    try {
      const plan: ShoppingParticipant[] = participants.map((participant) => ({
        personId: participant.personId,
        days: Number(participant.days),
        meals: mealTimes.map((mealTime) => ({ mealTime, recipeIds: participant.meals[mealTime] })),
      }));
      setResult(await api.calculateShopping({ days: Number(days), participants: plan }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo calcular la lista de compras.');
    } finally {
      setBusy(false);
    }
  }

  const loadError = peopleError ?? recipesError;
  const pageState = loadError ? 'error' : peopleBusy || recipesBusy ? 'loading' : 'data';

  return (
    <PageFrame title="Compras" subtitle="Suma exacta de recetas, participantes y días" state={pageState} hasData={true} error={loadError} onRetry={() => window.location.reload()} emptyTitle="No hay personas" emptyText="Registra una persona antes de crear una lista de compras.">
      <form className="shopping-planner" onSubmit={generateShopping}>
        <section className="content-section">
          <div className="shopping-planner-heading"><SectionHeading detail="Un menú distinto para cada persona si hace falta">Participantes y duración</SectionHeading><Field label="Días por defecto" hint="Puedes ajustar la duración por persona; las recetas seleccionadas se alternan." required><Input type="number" min="1" max="31" step="1" value={days} onChange={(_event, value) => { setDays(value.value); setParticipants((current) => current.map((participant) => ({ ...participant, days: value.value }))); setResult(null); }} required /></Field></div>
          {participants.map((participant, participantIndex) => {
            const person = people?.find((item) => item.id === participant.personId);
            return <Card appearance="outline" className="shopping-participant" key={participant.key}>
              <div className="shopping-planner-heading"><Field label={`Perfil de la persona ${participantIndex + 1}`} required><Select value={participant.personId} onChange={(event) => updateParticipant(participant.key, { personId: event.currentTarget.value, meals: emptyMeals() })}>{(people ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label={`Días para ${person?.name ?? `persona ${participantIndex + 1}`}`} required><Input type="number" min="1" max="31" step="1" value={participant.days} onChange={(_event, value) => updateParticipant(participant.key, { days: value.value })} required /></Field></div>
              <div className="shopping-meal-grid">{mealTimes.map((mealTime) => {
                const options = availableRecipes.filter((recipe) => recipe.personId === participant.personId && recipe.mealTime === mealTime);
                return <section className="shopping-meal" key={`${participant.key}-${mealTime}`}>
                  <SectionHeading detail={participant.meals[mealTime].length ? `${participant.meals[mealTime].length} seleccionada(s)` : 'Selecciona al menos una'}>{mealTime}</SectionHeading>
                  {options.length ? <div className="shopping-recipe-options">{options.map((recipe) => <Checkbox key={recipe.id} checked={participant.meals[mealTime].includes(recipe.id)} onChange={(_event, value) => toggleRecipe(participant.key, mealTime, recipe.id, Boolean(value.checked))} label={recipe.name} />)}</div> : <p className="shopping-no-recipes">Sin recetas verificadas para este perfil. <Link to="/recipes">Edita y verifica una receta</Link>.</p>}
                </section>;
              })}</div>
              {participants.length > 1 && <Button type="button" appearance="subtle" onClick={() => { setParticipants((current) => current.filter((item) => item.key !== participant.key)); setResult(null); }}>Quitar participante</Button>}
            </Card>;
          })}
          <div className="shopping-planner-actions"><Button type="button" icon={<AddRegular />} disabled={participants.length >= 6 || !people?.length} onClick={() => { setParticipants((current) => [...current, { key: crypto.randomUUID(), personId: people![0].id, days, meals: emptyMeals() }]); setResult(null); }}>Añadir participante ({participants.length}/6)</Button><Button type="submit" appearance="primary" icon={<ShoppingBagRegular />} disabled={!canGenerate}>{busy ? 'Calculando...' : 'Generar lista de compras'}</Button></div>
          {!availableRecipes.length && <Card appearance="outline" className="shopping-blocked"><WarningRegular /><p>Aún no hay recetas verificadas con ingredientes estructurados. Los borradores no se cuentan como recetas planificables. Edita una receta, ingresa cantidades por persona y verifica que coincida con la prescripción.</p></Card>}
        </section>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <section className="content-section shopping-results">
        <div className="shopping-planner-heading"><SectionHeading detail={`${result.participantCount} participantes · ${result.participants.map((participant) => `${people?.find((person) => person.id === participant.personId)?.name ?? 'Persona'}: ${participant.days} días`).join(' · ')}`}>Lista consolidada</SectionHeading><div className="action-row action-row-start"><Button icon={<PrintRegular />} disabled={!result.items.length} onClick={() => window.print()}>Imprimir</Button><Button icon={<DocumentRegular />} disabled title="PDF de esta lista estará disponible después">PDF</Button></div></div>
        <p className="field-note">Cada lista de recetas se alterna en el orden seleccionado y vuelve al inicio cuando termina; se suman todas las personas y días.</p>
        {result.items.length ? <Card appearance="outline" className="table-frame"><Table aria-label="Lista de compras calculada"><TableHeader><TableRow><TableHeaderCell>Alimento</TableHeaderCell><TableHeaderCell>Cantidad total</TableHeaderCell><TableHeaderCell>Unidad</TableHeaderCell></TableRow></TableHeader><TableBody>{result.items.map((item) => <TableRow key={`${item.foodId}-${item.unit}`}><TableCell>{item.name}</TableCell><TableCell>{amountForDisplay(item.quantity)}</TableCell><TableCell>{item.unit}</TableCell></TableRow>)}</TableBody></Table></Card> : <Card appearance="outline" className="empty-inline"><ShoppingBagRegular /><strong>La selección no requiere ingredientes medidos</strong><span>Los ingredientes libres sin cantidad física no se pueden sumar a la compra.</span></Card>}
      </section>}
    </PageFrame>
  );
}