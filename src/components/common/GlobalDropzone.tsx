import React, { useEffect, useState } from 'react';
import { UploadCloud, FileText, Sparkles, ShieldCheck } from 'lucide-react';

interface GlobalDropzoneProps {
  onFilesDropped: (files: File[]) => void;
}

export const GlobalDropzone: React.FC<GlobalDropzoneProps> = ({ onFilesDropped }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Ensure it is files being dragged
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setDragCounter((prev) => prev + 1);
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsDraggingOver(false);
          return 0;
        }
        return next;
      });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      setDragCounter(0);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filesArray = Array.from(e.dataTransfer.files);
        onFilesDropped(filesArray);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  if (!isDraggingOver) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-blue-950/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in select-none">
      <div className="w-full max-w-xl p-8 rounded-[32px] bg-white/95 border-2 border-dashed border-blue-500 shadow-2xl flex flex-col items-center text-center space-y-4 scale-100 transform transition-transform">
        <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center animate-bounce shadow-inner">
          <UploadCloud className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Drop Your File Anywhere!
          </h2>
          <p className="text-xs text-slate-600 max-w-md">
            OmniDoc Studio automatically detects your file format and opens the optimal studio or queues for conversion.
          </p>
        </div>

        {/* Supported Format Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {['PDF', 'DOCX', 'PPTX', 'XLSX', 'CSV', 'PNG', 'JPG', 'WEBP', 'TXT'].map((ext) => (
            <span
              key={ext}
              className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold"
            >
              .{ext.toLowerCase()}
            </span>
          ))}
        </div>

        <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>100% In-Browser Execution • Files never leave your computer</span>
        </div>
      </div>
    </div>
  );
};
