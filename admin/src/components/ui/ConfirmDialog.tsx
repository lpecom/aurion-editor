import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Tem certeza?',
  message = 'Esta acao nao pode ser desfeita.',
  confirmLabel = 'Excluir',
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            ref={cancelRef}
            onClick={onClose}
            className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-danger text-white font-medium border border-danger hover:bg-danger/90 px-4 py-2 rounded-md cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-danger/50 focus:outline-none"
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <p className="text-text-muted pt-2">{message}</p>
      </div>
    </Modal>
  );
}
