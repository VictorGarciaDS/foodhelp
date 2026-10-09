import type { ReactNode } from 'react';
import {
  Body1, Button, Card, MessageBar, MessageBarBody, MessageBarTitle, Skeleton, SkeletonItem, Subtitle1,
} from '@fluentui/react-components';
import { ArrowClockwiseRegular, BoxRegular } from '@fluentui/react-icons';
import type { PageState } from '../api/types';

type PageFrameProps = {
  title: string;
  subtitle: string;
  state: PageState;
  hasData: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
  emptyAction?: ReactNode;
};

export function PageFrame({ title, subtitle, state, hasData, error, onRetry, emptyTitle, emptyText, emptyAction, children }: PageFrameProps) {
  return (
    <main className="page-frame">
      <header className="page-heading">
        <div><span className="eyebrow">FOODHELP / ESPACIO FAMILIAR</span><h1>{title}</h1></div>
        <p>{subtitle}</p>
      </header>
      {state === 'loading' && <Card className="state-panel"><Skeleton><SkeletonItem size={24} /><SkeletonItem size={16} /><SkeletonItem size={16} /></Skeleton></Card>}
      {state === 'error' && (
        <MessageBar intent="error" className="state-message">
          <MessageBarBody><MessageBarTitle>Error de carga</MessageBarTitle>{error ?? 'No se pudieron cargar los datos.'}</MessageBarBody>
          <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>Reintentar</Button>
        </MessageBar>
      )}
      {state !== 'loading' && state !== 'error' && (state === 'empty' || !hasData) && (
        <Card appearance="outline" className="empty-state">
          <BoxRegular className="empty-icon" aria-hidden="true" />
          <Subtitle1>{emptyTitle}</Subtitle1>
          <Body1 className="muted">{emptyText}</Body1>
          {emptyAction}
        </Card>
      )}
      {state !== 'loading' && state !== 'error' && state !== 'empty' && hasData && children}
    </main>
  );
}

export function SectionHeading({ children, detail }: { children: ReactNode; detail?: string }) {
  return <div className="section-heading"><h2>{children}</h2>{detail && <span>{detail}</span>}</div>;
}