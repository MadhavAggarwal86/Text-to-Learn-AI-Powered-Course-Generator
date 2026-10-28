import { useEffect } from 'react';

const APP_NAME = 'Text-to-Learn';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
