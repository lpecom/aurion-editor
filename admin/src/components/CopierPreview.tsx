interface CopierPreviewProps {
  html: string;
}

export default function CopierPreview({ html }: CopierPreviewProps) {
  return (
    <div className="w-full h-full border border-border rounded-md overflow-hidden bg-white">
      <iframe
        srcDoc={html}
        sandbox="allow-same-origin"
        className="w-full h-full"
        title="Preview da página clonada"
      />
    </div>
  );
}
