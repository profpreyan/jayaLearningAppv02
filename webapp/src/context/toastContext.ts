import { createContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
