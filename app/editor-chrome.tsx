'use client';

import {useState, type ReactNode} from 'react';
import {ChevronDown, type LucideIcon} from 'lucide-react';

/** Presentation only: opening a control group never changes the map document. */
export function ControlGroup({title, description, icon: Icon, children, defaultOpen = false}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="control-group" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="control-group-icon"><Icon size={17} aria-hidden="true"/></span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ChevronDown className="group-chevron" size={15} aria-hidden="true"/>
      </summary>
      <div className="control-group-body">{children}</div>
    </details>
  );
}
