import { useState } from 'react';
import { Button, Card, MessageBar, MessageBarBody, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { CalendarRegular, DocumentRegular, LockClosedRegular } from '@fluentui/react-icons';
import { api } from '../api';
import type { WeekDay } from '../api/types';
import { PageFrame, SectionHeading } from '../components/PageFrame';
import { useResource } from '../hooks/useResource';
import { currentWeekStart } from '../utils/dates';

export function WeekPage() {
  const [weekStart] = useState(currentWeekStart);
  const { data, busy, error, reload } = useResource<WeekDay[]>(() => api.getWeek(weekStart), weekStart);
  const days = data ?? [];
  const pageState = error ? 'error' : busy ? 'loading' : 'data';

  return (
    <PageFrame
      title="Semana"
      subtitle="Siete días · 2–3 menús repetibles por día"
      state={pageState}
      hasData={days.length > 0}
      error={error}
      onRetry={reload}
      emptyTitle="Aún no hay un plan semanal"
      emptyText="Primero se deben revisar el catálogo y la prescripción, y confirmar las recetas del plan."
      emptyAction={<Button as="a" href="/people" appearance="primary" icon={<LockClosedRegular />}>Revisar datos familiares</Button>}
    >
      <section className="week-hero" aria-labelledby="week-hero-title">
        <div className="hero-copy">
          <span className="hero-eyebrow"><span className="status-dot status-dot-light" />PLANIFICACIÓN PENDIENTE</span>
          <h2 id="week-hero-title">Una semana familiar, con datos verificados.</h2>
          <p>FoodHelp no completa porciones ni recetas clínicas por cuenta propia. La generación seguirá bloqueada hasta revisar los datos reales.</p>
          <div className="hero-actions">
            <Button as="a" href="/people" appearance="primary" icon={<LockClosedRegular />}>Revisar datos</Button>
            <Button appearance="secondary" icon={<DocumentRegular />} disabled title="Disponible después de revisar un menú">Exportar menú PDF</Button>
          </div>
        </div>
        <div className="hero-date"><CalendarRegular /><span>Semana del</span><strong>{weekStart}</strong></div>
      </section>

      <MessageBar intent="warning" className="state-message">
        <MessageBarBody><strong>Generación bloqueada.</strong> No hay un planificador aprobado con recetas y porciones revisadas.</MessageBarBody>
      </MessageBar>

      <section className="content-section">
        <SectionHeading detail="Estado actual">Plan semanal</SectionHeading>
        <Card appearance="outline" className="table-frame">
          <Table aria-label="Estado de los siete días de la semana">
            <TableHeader><TableRow><TableHeaderCell>Día</TableHeaderCell><TableHeaderCell>Menús previstos</TableHeaderCell><TableHeaderCell>Estado</TableHeaderCell></TableRow></TableHeader>
            <TableBody>{days.map((day) => <TableRow key={day.day}><TableCell>{day.day}</TableCell><TableCell>{day.menuCount}</TableCell><TableCell><span className="status-pill status-pending">{day.status}</span></TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      </section>
      <div className="action-row">
        <Button appearance="secondary" icon={<DocumentRegular />} disabled title="No hay menús revisados para exportar">Exportar menú PDF</Button>
        <Button appearance="primary" icon={<LockClosedRegular />} disabled title="La generación requiere datos reales revisados">Generar semana</Button>
      </div>
    </PageFrame>
  );
}