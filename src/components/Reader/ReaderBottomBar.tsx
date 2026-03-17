'use client';

interface ReaderBottomBarProps {
  visible: boolean;
  currentPage: number;
  totalPages: number;
  spreadMode: boolean;
}

export default function ReaderBottomBar({ visible, currentPage, totalPages, spreadMode }: ReaderBottomBarProps) {
  const pageText = spreadMode && currentPage + 1 <= totalPages
    ? `Pages ${currentPage}-${currentPage + 1} / ${totalPages}`
    : `Page ${currentPage} / ${totalPages}`;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center px-4 py-3 bg-black/80 backdrop-blur-sm text-white text-sm transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {pageText}
    </div>
  );
}
