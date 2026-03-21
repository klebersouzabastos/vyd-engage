import { useEffect, useRef, useCallback } from 'react';

/**
 * Auto-focus the first focusable field within a container on mount.
 * Returns a ref to attach to the form/container element.
 */
export function useAutoFocus<T extends HTMLElement = HTMLFormElement>(
  /** Whether to auto-focus. Default: true */
  enabled = true,
  /** Delay in ms before focusing. Default: 100 (allows render to complete) */
  delay = 100
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"]), ' +
        'textarea:not([disabled]):not([tabindex="-1"]), ' +
        'select:not([disabled]):not([tabindex="-1"]), ' +
        '[tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      if (focusable) {
        focusable.focus();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [enabled, delay]);

  return containerRef;
}

/**
 * Manage focus return when a modal/dialog closes.
 * Call `saveTrigger()` before opening the modal, and the hook will
 * return focus to that element when the component unmounts or `returnFocus()` is called.
 */
export function useFocusReturn() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const saveTrigger = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
  }, []);

  const returnFocus = useCallback(() => {
    if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      // Small delay to ensure modal cleanup completes
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
        triggerRef.current = null;
      });
    }
  }, []);

  // Return focus on unmount
  useEffect(() => {
    return () => {
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, []);

  return { saveTrigger, returnFocus };
}
