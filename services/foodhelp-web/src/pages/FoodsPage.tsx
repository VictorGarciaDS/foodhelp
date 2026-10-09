import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Field, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { AddRegular, GridRegular } from '@fluentui/react-icons';
import { createFoodSchema, foodGroups, freeFoodGroups, type EquivalentResult, type Food, type FoodGroup } from '@foodhelp/contracts';
import { api } from '../api';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';

export function FoodsPage() {
  const [retryKey, setRetryKey] = useState(0);
  const [verified, setVerified] = useState(false);
  const [isFreeConsumption, setIsFreeConsumption] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<FoodGroup | ''>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [equivalent, setEquivalent] = useState<EquivalentResult | null>(null);
  const [equivalentError, setEquivalentError] = useState<string | null>(null);
  const { data, busy, error } = useResource<Food[]>(() => api.listFoods(), retryKey);
  const foods = data ?? [];
  const verifiedFoods = foods.filter((food) => food.verifiedAt && !food.isFreeConsumption);
  const pageState = error ? 'error' : busy ? 'loading' : 'data';

  useEffect(() => { setFormError(null); }, [retryKey]);

  async function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setFormError(null);
    setFormMessage(null);
    const form = new FormData(formElement);
    try {
      const group = String(form.get('group')) as FoodGroup;
      const input = createFoodSchema.parse({
        name: form.get('name'), group,
        baseQuantity: isFreeConsumption ? null : form.get('baseQuantity'),
        unit: isFreeConsumption ? null : form.get('unit'), isFreeConsumption, verified,
      });
      await api.createFood(input);
      setFormMessage(verified ? 'Alimento guardado como dato verificado.' : 'Alimento guardado pendiente de verificación.');
      setRetryKey((value) => value + 1);
      formElement.reset();
      setVerified(false);
      setIsFreeConsumption(false);
      setSelectedGroup('');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Revisa los datos ingresados.');
    }
  }

  async function calculateFoodEquivalent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEquivalent(null);
    setEquivalentError(null);
    const food = foods.find((item) => item.id === selectedFoodId);
    const quantity = new FormData(event.currentTarget).get('quantity')?.toString() ?? '';
    if (!food || food.isFreeConsumption || food.unit === null) {
      setEquivalentError('Selecciona un alimento porcionado del catálogo.');
      return;
    }
    try {
      setEquivalent(await api.calculateEquivalent(food.id, quantity, food.unit));
    } catch (caught) {
      setEquivalentError(caught instanceof Error ? caught.message : 'No se pudo calcular el equivalente.');
    }
  }

  return (
    <PageFrame title="Alimentos" subtitle="Catálogo manual · porciones base según fuente verificada" state={pageState} hasData={true} error={error} onRetry={() => setRetryKey((value) => value + 1)} emptyTitle="No hay alimentos cargados" emptyText="Agrega solo alimentos, cantidades base y unidades confirmados manualmente. No se incluyen datos de ejemplo.">
      <section className="content-section">
        <SectionHeading detail="Sin conversiones implícitas">Catálogo por grupo</SectionHeading>
        <Card appearance="outline" className="table-frame">
          <Table aria-label="Alimentos guardados por grupo">
            <TableHeader><TableRow><TableHeaderCell>Grupo</TableHeaderCell><TableHeaderCell>Alimento</TableHeaderCell><TableHeaderCell>Cantidad base</TableHeaderCell><TableHeaderCell>Unidad</TableHeaderCell><TableHeaderCell>Estado</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {foods.map((food) => <TableRow key={food.id}><TableCell>{food.group === 'Proteinas' ? 'Proteínas' : food.group === 'Azucar' ? 'Azúcar' : food.group === 'Lacteos' ? 'Lácteos' : food.group}</TableCell><TableCell>{food.name}</TableCell><TableCell>{food.portionPending ? 'Porción pendiente' : food.isFreeConsumption ? 'Libre' : food.baseQuantity}</TableCell><TableCell>{food.portionPending ? 'Por confirmar' : food.isFreeConsumption ? 'Sin porción' : food.unit}</TableCell><TableCell><span className={`status-pill ${food.verifiedAt ? 'status-confirmed' : 'status-pending'}`}>{food.verifiedAt ? 'Verificado' : 'Pendiente'}</span></TableCell></TableRow>)}
              {foods.length === 0 && foodGroups.map((group) => <TableRow key={group}><TableCell>{group}</TableCell><TableCell colSpan={3}>Sin alimentos cargados</TableCell><TableCell><span className="status-pill status-pending">Sin verificar</span></TableCell></TableRow>)}
            </TableBody>
          </Table>
          {foods.length === 0 && <p className="table-empty-note">Aún no se ha registrado ningún alimento.</p>}
        </Card>
      </section>

      <div className="form-grid">
        <form className="form-panel" onSubmit={saveFood} noValidate>
          <SectionHeading detail="La fuente se confirma manualmente">Agregar alimento</SectionHeading>
          <Field label="Nombre del alimento" required><Input name="name" required maxLength={160} /></Field>
          <Field label="Grupo alimentario" required><Select name="group" value={selectedGroup} onChange={(event) => { const group = event.currentTarget.value as FoodGroup; setSelectedGroup(group); setIsFreeConsumption((freeFoodGroups as readonly string[]).includes(group) && group !== 'Verduras'); }} required><option value="" disabled>Seleccionar grupo</option>{foodGroups.map((group) => <option key={group} value={group}>{group === 'Proteinas' ? 'Proteínas' : group === 'Azucar' ? 'Azúcar' : group}</option>)}</Select></Field>
          <Field><Checkbox checked={isFreeConsumption} disabled={selectedGroup !== 'Verduras'} onChange={(_event, data) => setIsFreeConsumption(Boolean(data.checked))} label="Verdura de consumo libre, sin porción" /></Field>
          <div className="form-pair">
            <Field label="Cantidad base" required={!isFreeConsumption}><Input name="baseQuantity" placeholder="Ej. 1/2 o 30" required={!isFreeConsumption} disabled={isFreeConsumption} /></Field>
            <Field label="Unidad (tal como aparece en la fuente)" required={!isFreeConsumption}><Input name="unit" required={!isFreeConsumption} maxLength={80} disabled={isFreeConsumption} /></Field>
          </div>
          <Field validationState={verified ? 'none' : 'warning'} validationMessage={verified ? undefined : 'Sin esta confirmación, el alimento no habilita generación.'}>
            <Checkbox checked={verified} onChange={(_event, data) => setVerified(Boolean(data.checked))} label="Confirmo que estos datos se revisaron contra una fuente real" />
          </Field>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          {formMessage && <p className="form-success" role="status">{formMessage}</p>}
          <div className="action-row action-row-start"><Button type="submit" appearance="primary" icon={<AddRegular />}>Guardar alimento</Button></div>
        </form>

        <Card appearance="outline" className="calculation-panel">
          <SectionHeading detail="Pruebas aritméticas, no alimentos registrados">Ejemplos de cálculo</SectionHeading>
          <p>2 galletas ÷ base 4 = <strong>0.5 equivalentes</strong></p>
          <p>3 cucharadas de granola ÷ base 2 = <strong>1.5 equivalentes</strong></p>
          <form className="calculation-form" onSubmit={calculateFoodEquivalent}>
            <SectionHeading detail="Usa solo un alimento ingresado">Calcular equivalentes</SectionHeading>
            <Field label="Alimento" required>
              <Select value={selectedFoodId} onChange={(event) => { setSelectedFoodId(event.currentTarget.value); setEquivalent(null); setEquivalentError(null); }} required>
                <option value="" disabled>Seleccionar alimento verificado</option>
                {verifiedFoods.map((food) => <option key={food.id} value={food.id}>{food.name} · {food.unit}</option>)}
              </Select>
            </Field>
            <Field label={`Cantidad (${foods.find((food) => food.id === selectedFoodId)?.unit ?? 'unidad registrada'})`} required>
              <Input name="quantity" type="number" min="0.000001" step="any" required />
            </Field>
            <Button type="submit" appearance="secondary" disabled={verifiedFoods.length === 0}>Calcular</Button>
            {equivalentError && <p className="form-error" role="alert">{equivalentError}</p>}
            {equivalent && <p className="form-success" role="status">Resultado exacto: {equivalent.numerator}/{equivalent.denominator}{equivalent.decimal === null ? ' (sin decimal finito)' : ` = ${equivalent.decimal}`} equivalentes.</p>}
          </form>
          <span className="status-pill status-neutral"><GridRegular /> Sin conversiones entre unidades incompatibles</span>
        </Card>
      </div>
    </PageFrame>
  );
}