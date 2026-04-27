import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

// Wraps a row with a left-edge drag handle. The handle owns the dnd listeners
// so a click on the row body still bubbles to whatever (edit) handler the page
// puts there. The dragged item gets a shadow + slight rotate; the placeholder
// fades so siblings can animate into the gap.
export function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: transform
      ? `${CSS.Transform.toString(transform)}${isDragging ? " rotate(1.5deg)" : ""}`
      : undefined,
    transition,
    opacity: isDragging ? 0.95 : 1,
    boxShadow: isDragging ? "0 12px 28px rgba(0,0,0,0.18)" : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        className="flex items-center justify-center w-6 shrink-0 self-stretch rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
