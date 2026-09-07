'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle, Trash2, X } from 'lucide-react';

interface ModalOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'prompt';
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  inputPlaceholder?: string;
  isDestructive?: boolean;
  onConfirm?: (value?: string) => void | Promise<void>;
  onCancel?: () => void;
}

interface ModalContextType {
  showModal: (options: ModalOptions) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText?: string,
    isDestructive?: boolean
  ) => void;
  showPrompt: (
    title: string,
    message: string,
    defaultValue: string,
    onConfirm: (val: string) => void | Promise<void>,
    inputPlaceholder?: string
  ) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ModalOptions;
    inputValue: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    inputValue: '',
    isSubmitting: false,
  });

  const showModal = useCallback((options: ModalOptions) => {
    setModalState({
      isOpen: true,
      options,
      inputValue: options.defaultValue || '',
      isSubmitting: false,
    });
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'success', confirmText: 'OK' });
  }, [showModal]);

  const showError = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'error', confirmText: 'Close', isDestructive: true });
  }, [showModal]);

  const showInfo = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'info', confirmText: 'Got It' });
  }, [showModal]);

  const showWarning = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'warning', confirmText: 'Understood' });
  }, [showModal]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText = 'Confirm',
    isDestructive = false
  ) => {
    showModal({
      title,
      message,
      type: 'confirm',
      confirmText,
      cancelText: 'Cancel',
      isDestructive,
      onConfirm,
    });
  }, [showModal]);

  const showPrompt = useCallback((
    title: string,
    message: string,
    defaultValue = '',
    onConfirm: (val: string) => void | Promise<void>,
    inputPlaceholder = ''
  ) => {
    showModal({
      title,
      message,
      type: 'prompt',
      defaultValue,
      inputPlaceholder,
      confirmText: 'Submit',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await onConfirm(modalState.inputValue);
      },
    });
  }, [showModal, modalState.inputValue]);

  const handleClose = useCallback(() => {
    if (modalState.options.onCancel) {
      modalState.options.onCancel();
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, [modalState.options]);

  const handleConfirm = useCallback(async () => {
    if (modalState.options.onConfirm) {
      setModalState(prev => ({ ...prev, isSubmitting: true }));
      try {
        await modalState.options.onConfirm(modalState.inputValue);
        setModalState(prev => ({ ...prev, isOpen: false, isSubmitting: false }));
      } catch (err) {
        setModalState(prev => ({ ...prev, isSubmitting: false }));
      }
    } else {
      setModalState(prev => ({ ...prev, isOpen: false }));
    }
  }, [modalState.options, modalState.inputValue]);

  // Handle ESC key for closing modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState.isOpen && !modalState.isSubmitting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState.isOpen, modalState.isSubmitting, handleClose]);

  const { options, inputValue, isSubmitting } = modalState;
  const modalType = options.type || 'info';

  const typeConfig = {
    success: {
      accentLine: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      badgeText: 'Success',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50',
      Icon: CheckCircle2,
    },
    error: {
      accentLine: 'bg-rose-500',
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-200/80',
      badge: 'bg-rose-50 text-rose-700 border-rose-200/70',
      badgeText: 'Error',
      confirmBtn: 'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200/90 font-bold shadow-xs',
      Icon: XCircle,
    },
    warning: {
      accentLine: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/80',
      badge: 'bg-amber-50 text-amber-700 border-amber-200/70',
      badgeText: 'Warning',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm shadow-amber-200 hover:shadow-md hover:shadow-amber-300/50',
      Icon: AlertTriangle,
    },
    info: {
      accentLine: 'bg-indigo-600',
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      badgeText: 'Notice',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50',
      Icon: Info,
    },
    confirm: {
      accentLine: options.isDestructive ? 'bg-rose-500' : 'bg-indigo-600',
      iconBg: options.isDestructive
        ? 'bg-rose-50 text-rose-600 border border-rose-200/80'
        : 'bg-indigo-50 text-indigo-600 border border-indigo-200/80',
      badge: options.isDestructive
        ? 'bg-rose-50 text-rose-700 border-rose-200/70'
        : 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      badgeText: options.isDestructive ? 'Delete Confirmation' : 'Confirm Action',
      confirmBtn: options.isDestructive
        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 font-bold shadow-xs'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50',
      Icon: options.isDestructive ? Trash2 : HelpCircle,
    },
    prompt: {
      accentLine: 'bg-indigo-600',
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      badgeText: 'Input',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50',
      Icon: HelpCircle,
    },
  }[modalType];

  const { Icon, iconBg, badge, badgeText, confirmBtn, accentLine } = typeConfig;

  return (
    <ModalContext.Provider
      value={{
        showModal,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        showConfirm,
        showPrompt,
      }}
    >
      {children}

      {modalState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={e => {
            if (e.target === e.currentTarget && !isSubmitting) {
              handleClose();
            }
          }}
        >
          {/* Card Container */}
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200/90 shadow-2xl shadow-slate-200/60 overflow-hidden relative transition-all duration-200 transform animate-in fade-in zoom-in-95 ease-out">
            
            {/* Top Accent Line */}
            <div className={`h-1.5 w-full ${accentLine}`} />

            {/* Close (×) Button */}
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              title="Close (Esc)"
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                {/* Visual Icon Badge */}
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${iconBg}`}>
                  <Icon className="h-5 w-5 stroke-[2]" />
                </div>

                {/* Text Content */}
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge}`}>
                      {badgeText}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight mt-1.5 leading-snug">
                    {options.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium whitespace-pre-wrap">
                    {options.message}
                  </p>
                </div>
              </div>

              {/* Input for Prompt Mode */}
              {modalType === 'prompt' && (
                <div className="pt-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder={options.inputPlaceholder || 'Enter value...'}
                    value={inputValue}
                    onChange={e => setModalState(prev => ({ ...prev, inputValue: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleConfirm();
                    }}
                    className="w-full px-3 py-2 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200/90 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm transition-all duration-200"
                  />
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2">
              {options.cancelText && (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-xl shadow-sm active:scale-[0.98] transition-all duration-150"
                >
                  {options.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                autoFocus={modalType !== 'prompt'}
                className={`px-5 py-2 text-xs rounded-xl active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5 ${confirmBtn}`}
              >
                {isSubmitting ? 'Processing...' : options.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
