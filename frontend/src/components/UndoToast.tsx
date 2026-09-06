import { useEffect, useState } from "react";

export interface UndoItem {
  id: string;
  label: string;
  undoFn: () => void;
}

interface Props {
  items: UndoItem[];
  onDismiss: (id: string) => void;
  durationMs?: number;
}

export function UndoToast({ items, onDismiss, durationMs = 5000 }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => items.forEach((i) => onDismiss(i.id)), 300);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [items, durationMs, onDismiss]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast-message">
        {items.length === 1 ? items[0].label : `${items.length} items deleted`}
      </span>
      <div className="undo-toast-actions">
        {items.map((item) => (
          <button
            key={item.id}
            className="undo-btn"
            onClick={() => {
              item.undoFn();
              onDismiss(item.id);
            }}
          >
            Undo
          </button>
        ))}
        <button className="undo-dismiss" onClick={() => onDismiss(items[0].id)} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
