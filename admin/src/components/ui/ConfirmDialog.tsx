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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 px-4 py-2 rounded-md cursor-pointer transition-colors duration-200 disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-text-muted">{message}</p>
    </Modal>
  );
}
