import type { ReactNode } from 'react';
import { ActivityReviewGraphic, CourseGraphic, PracticeGraphic } from '../landing/Illustrations';

type Props = {
  role: 'student' | 'teacher' | 'admin';
  greeting: string;
  name?: string;
  description: string;
  meta?: string;
  children?: ReactNode;
};

export default function WorkspaceHero({ role, greeting, name, description, meta, children }: Props) {
  return <section className="bezel workspace-hero">
    <div className="bezel-core workspace-hero-core">
      <div className="workspace-hero-copy">
        <span className="eyebrow eyebrow-light"><span className="workspace-status-dot" />
          {role === 'teacher' ? 'Educator workspace' : role === 'admin' ? 'Platform overview' : 'Your learning workspace'}
        </span>
        <h1 className="workspace-heading">{greeting} <span className="era-gradient-text">{name || 'there'}</span></h1>
        <p className="workspace-description">{description}</p>
        {meta && <p className="workspace-meta">{meta}</p>}
        {children && <div className="workspace-actions">{children}</div>}
      </div>
      <div className="workspace-hero-art">
        {role === 'student' ? <PracticeGraphic /> : role === 'teacher' ? <CourseGraphic /> : <ActivityReviewGraphic />}
        <span className="workspace-art-caption">{role === 'student' ? 'Learn. Practise. Make progress.' : role === 'teacher' ? 'Create. Teach. Review.' : 'Activity, with context.'}</span>
      </div>
    </div>
  </section>;
}
