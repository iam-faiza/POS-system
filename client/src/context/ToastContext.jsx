import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);
const TOAST_DURATION_MS = 4000;
const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());

  const updateToasts = useCallback((updater) => {
    toastsRef.current = updater(toastsRef.current);
    setToasts(toastsRef.current);
  }, []);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    updateToasts((current) => current.filter((toast) => toast.id !== id));
  }, [updateToasts]);

  const showToast = useCallback((message, type = 'info') => {
    if (!message) return;
    // Scanning the same bad item repeatedly should not stack identical toasts.
    if (toastsRef.current.some((toast) => toast.message === message && toast.type === type)) return;

    const id = nextId.current++;
    updateToasts((current) => [...current.slice(-(MAX_VISIBLE_TOASTS - 1)), { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), TOAST_DURATION_MS));
  }, [dismissToast, updateToasts]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
