import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, HelpCircle } from 'lucide-react';
import { ModalType } from '../types';

// --- Windows 11 Card ---
// Uses the "Layer" background color typical of Win11 content blocks
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-fluent-layer border border-fluent-border rounded-window p-5 shadow-sm transition-all duration-200 ${onClick ? 'hover:bg-fluent-layerHover cursor-pointer active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

// --- Windows 11 Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading = false,
  ...props 
}) => {
  const baseStyles = "px-4 h-[32px] rounded-control font-normal text-[13px] transition-all flex items-center justify-center gap-2 select-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 focus:ring-offset-white/20";
  
  const variants = {
    // Accent Color Button
    primary: "bg-fluent-accent text-black hover:bg-fluent-accentHover active:bg-fluent-accent/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
    // Standard Neutral Button
    secondary: "bg-white/5 text-white border border-white/5 hover:bg-white/10 active:bg-white/5",
    // Ghost/Text Button
    ghost: "bg-transparent text-white hover:bg-white/5 active:bg-white/10 active:text-white/80",
    // Danger
    danger: "bg-red-500/20 text-red-200 border border-red-500/30 hover:bg-red-500/30",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-70 cursor-wait' : ''} ${className}`} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

// --- Windows 11 Input ---
// Features the bottom-border accent focus state
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {label && <label className="text-[13px] text-fluent-text font-normal">{label}</label>}
      <div className="relative group">
        <input
          className={`w-full bg-white/5 border border-white/10 border-b-white/30
            rounded-control px-3 h-[32px] text-sm text-white placeholder-white/40 
            hover:bg-white/10 hover:border-b-white/50
            focus:outline-none focus:bg-[#1e1e1e] focus:border-b-fluent-accent focus:border-b-2
            transition-all disabled:opacity-50
            ${error ? 'border-red-500 border-b-red-500' : ''}
            ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-300 ml-0.5">{error}</span>}
    </div>
  );
};

// --- Windows 11 Acrylic Window Panel ---
export const AcrylicPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="h-screen w-full bg-fluent-mica/95 backdrop-blur-[60px] flex flex-col overflow-hidden text-white relative">
      {/* Mica Texture Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col h-full">
          {children}
      </div>
    </div>
  );
};

// --- Windows 11 Modal ---
interface ModalProps {
  isOpen: boolean;
  type: ModalType;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  type,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel"
}) => {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle2 size={24} className="text-green-400" />,
    error: <XCircle size={24} className="text-red-400" />,
    warning: <AlertTriangle size={24} className="text-yellow-400" />,
    confirm: <HelpCircle size={24} className="text-fluent-accent" />,
    info: <Info size={24} className="text-blue-400" />
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="bg-fluent-layer border border-fluent-border rounded-window shadow-flyout max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 scale-100 ring-1 ring-white/5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 mb-1">
             {icons[type]}
             <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          
          <div className="text-fluent-subtext text-sm leading-relaxed">
            {children}
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/5">
            {type === 'confirm' ? (
              <>
                <Button variant="secondary" onClick={onCancel} className="min-w-[80px]">
                  {cancelLabel}
                </Button>
                <Button variant="primary" onClick={onConfirm} className="min-w-[80px]">
                  {confirmLabel}
                </Button>
              </>
            ) : (
              <Button 
                variant="primary" 
                onClick={onCancel} 
                className="min-w-[80px]"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};