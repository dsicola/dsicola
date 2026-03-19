/**
 * Serialização de FormData para armazenamento em IndexedDB.
 * Permite enfileirar pedidos com upload de ficheiros para retry offline.
 */

export interface FormDataEntryStored {
  key: string;
  value: string | Blob;
}

export const FORM_DATA_MARKER = '__formData';

export interface FormDataStored {
  [FORM_DATA_MARKER]: true;
  entries: FormDataEntryStored[];
}

export function isFormDataStored(data: unknown): data is FormDataStored {
  return (
    typeof data === 'object' &&
    data !== null &&
    FORM_DATA_MARKER in data &&
    (data as FormDataStored)[FORM_DATA_MARKER] === true
  );
}

/** Converte FormData para formato armazenável (IndexedDB suporta Blob) */
export async function formDataToStored(formData: FormData): Promise<FormDataStored> {
  const entries: FormDataEntryStored[] = [];
  for (const [key, value] of formData.entries()) {
    entries.push({ key, value });
  }
  return { [FORM_DATA_MARKER]: true, entries };
}

/** Reconstrói FormData a partir do formato armazenado */
export function storedToFormData(stored: FormDataStored): FormData {
  const formData = new FormData();
  for (const { key, value } of stored.entries) {
    formData.append(key, value);
  }
  return formData;
}
