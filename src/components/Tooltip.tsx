import React, { useState, useRef } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = (e: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    const target = e.currentTarget as HTMLElement;
    timer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: pos.x,
            top: pos.y,
            transform: "translateX(-50%) translateY(-100%)",
          }}
        >
          <div
            className="rounded-lg px-3 py-2 text-xs max-w-xs text-center shadow-xl"
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#e2e8f0",
              maxWidth: 260,
              lineHeight: "1.5",
            }}
          >
            {content}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                bottom: -5,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid #334155",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
