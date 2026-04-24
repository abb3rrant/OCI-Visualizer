import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

// ---- Global toast bus (usable outside React) ----

type ToastType = 'error' | 'info' | 'success';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: Toast) => void;

let nextId = 1;
const listeners: Set<ToastListener> = new Set();

export function showToast(message: string, type: ToastType = 'error') {
  const toast: Toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}

function subscribe(fn: ToastListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ---- React component ----

const DISMISS_MS = 5000;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => dismiss(oldest.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  const bgColors: Record<ToastType, string> = {
    error: 'bg-red-600',
    info: 'bg-blue-600',
    success: 'bg-green-600',
  };

  return ReactDOM.createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-start gap-2 animate-in slide-in-from-right`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-white/80 hover:text-white font-bold ml-2"
          >
            &times;
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
