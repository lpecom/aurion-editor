import { Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DesktopOnlyPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg px-6 text-center">
      <div className="rounded-2xl bg-surface-2/50 p-6 mb-6">
        <Monitor className="w-12 h-12 text-text-muted" />
      </div>
      <h2 className="text-xl font-semibold text-text mb-2">Disponivel apenas no desktop</h2>
      <p className="text-text-muted text-sm mb-6 max-w-xs">
        Use um computador para acessar o editor visual de paginas e funis.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="bg-primary text-bg font-medium rounded-lg px-6 py-2.5 cursor-pointer hover:bg-primary/90 transition-colors duration-200"
      >
        Voltar
      </button>
    </div>
  );
}
