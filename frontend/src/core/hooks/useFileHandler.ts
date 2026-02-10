import { useCallback } from 'react';
import { useFileActions, useFileState } from '@app/contexts/FileContext';
import type { StirlingFile } from '@app/types/fileContext';

export const useFileHandler = () => {
  const { actions } = useFileActions();
  const { selectors: { getFile } } = useFileState();

  const addFiles = useCallback(async (files: File[], options: { insertAfterPageId?: string; selectFiles?: boolean } = {}): Promise<StirlingFile[]> => {
    // Merge default options with passed options - passed options take precedence
    const mergedOptions = { selectFiles: true, ...options };
    // Let FileContext handle deduplication with quickKey logic
    const result = await actions.addFiles(files, mergedOptions);
    return result;
  }, [actions.addFiles]);

  return {
    addFiles,
    downloadFile: actions.downloadFile,
    getFile,
  };
};
