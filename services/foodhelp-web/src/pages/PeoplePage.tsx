import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { AddRegular, ArrowClockwiseRegular, DeleteRegular, DismissRegular, EditRegular, SaveRegular } from '@fluentui/react-icons';
import { prescriptionFoodGroups, prescriptionSchema } from '@foodhelp/contracts';
import { api } from '../api';
import type { PrescriptionInput, PrescriptionRecord } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

type MealRow = PrescriptionInput['meals'][number] & { key: string };
type Editor = { id?: string; month: string; indicatedOn: string; reviewed: boolean; meals: MealRow[] };
const groupLabel = (group: string) => ({ Proteinas: 'Proteínas', Azucar: 'Azúcar', Lacteos: 'Lácteos' }[group] ?? group);
const emptyMeal = (): MealRow => ({ key: crypto.randomUUID(), mealTime: '', group: 'Frutas', equivalents: '', requirementKind: 'exact', preferredFoodId: null, notes: null });

export function PeoplePage() {
  const { data, busy, error, reload } = useResource(() => api.listPeople(), 0);
  const people = data ?? [];
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const personId = people.some((person) => person.id === selectedPersonId) ? selectedPersonId : people[0]?.id ?? '';
  const selectedPerson = people.find((person) => person.id === personId);
  const prescriptions = useResource<PrescriptionRecord[]>(() => personId ? api.listPrescriptions(personId) : Promise.resolve([]), personId);
  const foods = useResource(() => api.listFoods(), 0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const editorOpen = editor !== null;
  useEffect(() => {
    if (editorOpen) editorRef.current?.scrollIntoView({ block: 'start' });
  }, [editorOpen, editor?.id]);
  const [toDelete, setToDelete] = useState<PrescriptionRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const pageState = error ? 'error' : busy ? 'loading' : 'data';

  function clearMessages() { setFormError(null); setFormMessage(null); }
  function editPrescription(record: PrescriptionRecord) {
    clearMessages();
    setEditor({ id: record.id, month: record.month, indicatedOn: record.indicatedOn ?? '', reviewed: false, meals: record.meals.map((meal) => ({ ...meal, key: crypto.randomUUID() })) });
  }
  function updateMeal(key: string, changes: Partial<MealRow>) {
    setEditor((current) => current && ({ ...current, reviewed: false, meals: current.meals.map((meal) => meal.key === key ? { ...meal, ...changes } : meal) }));
  }
  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearMessages(); setSaving(true);
    try {
      const person = await api.createPerson(new FormData(form).get('name')?.toString().trim() ?? '');
      form.reset(); setSelectedPersonId(person.id); setEditor(null); reload();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'No se pudo guardar la persona.'); }
    finally { setSaving(false); }
  }
  async function savePrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !personId) return;
    clearMessages(); setSaving(true);
    try {
      if (!editor.id && prescriptions.data?.some((record) => record.month === editor.month)) throw new Error('Ya existe una prescripción para ese mes. Usa Editar para modificarla.');
      const input = prescriptionSchema.safeParse({ month: editor.month, indicatedOn: editor.indicatedOn || null, reviewed: editor.reviewed, meals: editor.meals });
      if (!input.success) throw new Error(input.error.issues.map((issue) => issue.message).join(' '));
      await api.savePrescription(personId, input.data);
      setEditor(null); prescriptions.reload(); reload(); setFormMessage('Prescripción completa guardada.');
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'Revisa los valores capturados.'); }
    finally { setSaving(false); }
  }
  async function deletePrescription() {
    if (!toDelete || !personId) return;
    clearMessages(); setSaving(true);
    try {
      await api.deletePrescription(personId, toDelete.id);
      if (editor?.id === toDelete.id) setEditor(null);
      setToDelete(null); prescriptions.reload(); reload(); setFormMessage('Prescripción eliminada.');
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'No se pudo eliminar la prescripción.'); setToDelete(null); }
    finally { setSaving(false); }
  }

  return (
    <PageFrame title="Personas y prescripciones" subtitle="Indicaciones mensuales por persona" state={pageState} hasData={true} error={error} onRetry={reload} emptyTitle="No hay personas" emptyText="Agrega una persona para registrar su prescripción.">
      <section className="content-section person-selector">
        <Field label="Persona seleccionada"><Select disabled={saving || people.length === 0} value={personId} onChange={(event) => { setSelectedPersonId(event.currentTarget.value); setEditor(null); clearMessages(); }}>{people.length === 0 && <option value="">Sin personas registradas</option>}{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field>
        <form className="form-panel" onSubmit={addPerson}><SectionHeading>Agregar persona</SectionHeading><Field label="Nombre" required><Input name="name" required maxLength={120} disabled={saving} /></Field><Button type="submit" icon={<AddRegular />} disabled={saving}>Agregar</Button></form>
      </section>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      {formMessage && <p className="form-success" role="status">{formMessage}</p>}
      <section className="content-section">
        <div className="prescription-heading"><SectionHeading>{selectedPerson?.name ?? 'Prescripciones'}</SectionHeading><Button appearance="primary" icon={<AddRegular />} disabled={!personId || saving || prescriptions.busy || !!prescriptions.error} onClick={() => { clearMessages(); setEditor({ month: '', indicatedOn: '', reviewed: false, meals: [emptyMeal()] }); }}>Añadir prescripción</Button></div>
        {prescriptions.busy ? <p role="status">Cargando prescripciones...</p> : prescriptions.error ? <div><p className="form-error" role="alert">{prescriptions.error}</p><Button icon={<ArrowClockwiseRegular />} onClick={prescriptions.reload}>Reintentar</Button></div> : (
          <div className="prescription-list">{(prescriptions.data ?? []).map((record) => (
            <section key={record.id} className="prescription-record">
              <div className="prescription-heading"><div><h2>{record.month}</h2><p>Consulta: {record.indicatedOn ?? 'Sin fecha registrada'}</p></div><div className="action-row"><Button icon={<EditRegular />} disabled={saving} onClick={() => editPrescription(record)}>Editar</Button><Button icon={<DeleteRegular />} disabled={saving} onClick={() => { clearMessages(); setToDelete(record); }}>Eliminar</Button></div></div>
              <div className="table-frame"><Table aria-label={`Prescripción ${record.month}`}><TableHeader><TableRow><TableHeaderCell>Tiempo</TableHeaderCell><TableHeaderCell>Grupo</TableHeaderCell><TableHeaderCell>Porciones</TableHeaderCell><TableHeaderCell>Indicación</TableHeaderCell><TableHeaderCell>Alimento preferido</TableHeaderCell></TableRow></TableHeader><TableBody>{record.meals.map((meal, index) => <TableRow key={index}><TableCell>{meal.mealTime}</TableCell><TableCell>{groupLabel(meal.group)}</TableCell><TableCell>{meal.equivalents}</TableCell><TableCell>{meal.requirementKind === 'free_guidance' ? 'Libre' : 'Exacta'}{meal.notes && <p className="prescription-note">{meal.notes}</p>}</TableCell><TableCell>{foods.data?.find((food) => food.id === meal.preferredFoodId)?.name ?? (meal.preferredFoodId ? 'Alimento asignado' : 'Sin preferencia')}</TableCell></TableRow>)}</TableBody></Table></div>
            </section>
          ))}{prescriptions.data?.length === 0 && <p>No hay prescripciones guardadas para esta persona.</p>}</div>
        )}
      </section>
      {editor && <form ref={editorRef} className="prescription-editor" onSubmit={savePrescription}>
        <SectionHeading>{editor.id ? `Editar prescripción ${editor.month}` : 'Nueva prescripción'}</SectionHeading>
        <fieldset disabled={saving} className="prescription-fields">
          <div className="form-pair"><Field label="Mes de vigencia" required><Input type="month" required value={editor.month} disabled={!!editor.id} onChange={(_event, value) => setEditor({ ...editor, month: value.value, reviewed: false })} /></Field><Field label="Fecha de consulta"><Input type="date" value={editor.indicatedOn} onChange={(_event, value) => setEditor({ ...editor, indicatedOn: value.value, reviewed: false })} /></Field></div>
          {editor.meals.map((meal, index) => (
            <div className="prescription-item-editor" key={meal.key}>
              <Field label={`Tiempo de comida ${index + 1}`} required><Input required value={meal.mealTime} list="meal-times" onChange={(_event, value) => updateMeal(meal.key, { mealTime: value.value })} /></Field>
              <Field label={`Grupo ${index + 1}`} required><Select value={meal.group} onChange={(event) => { const group = event.currentTarget.value as MealRow['group']; updateMeal(meal.key, { group, preferredFoodId: null, requirementKind: group === 'Verduras' ? 'free_guidance' : 'exact' }); }}>{prescriptionFoodGroups.map((group) => <option key={group} value={group}>{groupLabel(group)}</option>)}</Select></Field>
              <Field label={`Porciones ${index + 1}`} required><Input type="number" min="0" step="any" required value={meal.equivalents} onChange={(_event, value) => updateMeal(meal.key, { equivalents: value.value })} /></Field>
              <Field label={`Indicación ${index + 1}`}><Select value={meal.requirementKind ?? 'exact'} disabled={meal.group !== 'Verduras'} onChange={(event) => updateMeal(meal.key, { requirementKind: event.currentTarget.value as 'exact' | 'free_guidance' })}><option value="exact">Porciones exactas</option><option value="free_guidance">Verduras libres</option></Select></Field>
              <Field label={`Alimento preferido ${index + 1}`}><Select value={meal.preferredFoodId ?? ''} onChange={(event) => updateMeal(meal.key, { preferredFoodId: event.currentTarget.value || null })}><option value="">Sin preferencia</option>{meal.preferredFoodId && !foods.data?.some((food) => food.id === meal.preferredFoodId) && <option value={meal.preferredFoodId}>Alimento asignado</option>}{(foods.data ?? []).filter((food) => food.group === meal.group).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</Select></Field>
              <Field label={`Notas ${index + 1}`}><Input value={meal.notes ?? ''} onChange={(_event, value) => updateMeal(meal.key, { notes: value.value || null })} /></Field>
              <Button className="remove-prescription-row" type="button" icon={<DeleteRegular />} title={`Eliminar fila ${index + 1}`} aria-label={`Eliminar fila ${index + 1}`} disabled={editor.meals.length === 1} onClick={() => setEditor({ ...editor, reviewed: false, meals: editor.meals.filter((row) => row.key !== meal.key) })} />
            </div>
          ))}
          <datalist id="meal-times">{['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((meal) => <option key={meal} value={meal} />)}</datalist>
          <Button type="button" icon={<AddRegular />} onClick={() => setEditor({ ...editor, reviewed: false, meals: [...editor.meals, emptyMeal()] })}>Añadir indicación</Button>
          <Checkbox checked={editor.reviewed} onChange={(_event, value) => setEditor({ ...editor, reviewed: !!value.checked })} label="Confirmo que todas las indicaciones coinciden con la prescripción" />
          <div className="action-row action-row-start"><Button type="submit" appearance="primary" icon={<SaveRegular />} disabled={!editor.reviewed}>Guardar prescripción</Button><Button type="button" icon={<DismissRegular />} onClick={() => { setEditor(null); clearMessages(); }}>Cancelar</Button></div>
        </fieldset>
      </form>}
      <Dialog open={!!toDelete} onOpenChange={(_event, value) => { if (!value.open && !saving) setToDelete(null); }}><DialogSurface><DialogBody><DialogTitle>Eliminar prescripción</DialogTitle><DialogContent>Se eliminarán todas las indicaciones de {toDelete?.month} de {selectedPerson?.name}. Esta acción no se puede deshacer.</DialogContent><DialogActions><Button disabled={saving} icon={<DismissRegular />} onClick={() => setToDelete(null)}>Cancelar</Button><Button disabled={saving} appearance="primary" icon={<DeleteRegular />} onClick={deletePrescription}>{saving ? 'Eliminando...' : 'Eliminar prescripción'}</Button></DialogActions></DialogBody></DialogSurface></Dialog>
    </PageFrame>
  );
}