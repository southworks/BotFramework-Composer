// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { Diagnostic, LgFile } from '@bfc/shared';
import { selectorFamily } from 'recoil';
import { filterCustomFunctionError } from '@bfc/indexers/lib/utils/lgUtil';

import { lgFileIdsState, lgFileState, settingsState } from '../atoms';
import { IndexedDBCache } from '../persistence/indexerDBcache';

const db: IndexedDBCache = new IndexedDBCache();

export const lgFilesSelectorFamily = selectorFamily<LgFile[], string>({
  key: 'lgFiles',
  get: (projectId: string) => async ({ get }) => {
    const settings = get(settingsState(projectId));
    const lgFiles = await db.projects.get(projectId);
    const result: { file: LgFile; diagnostics: Diagnostic[] }[] = [];

    lgFiles.forEach((file) => {
      const diagnostics = filterCustomFunctionError(file.diagnostics, settings?.customFunctions ?? []);
      const item = { ...file, diagnostics };
      result.push(item);
    });

    return (result as unknown) as LgFile[];
  },
  set: (projectId: string) => async ({ set }, newLgFiles) => {
    const newLgFileArray = newLgFiles as LgFile[];
    set(
      lgFileIdsState(projectId),
      newLgFileArray.map((lgFile) => lgFile.id)
    );
    newLgFileArray.forEach((lgFile) => set(lgFileState({ projectId, lgFileId: lgFile.id }), lgFile));
    await db.projects.put(newLgFileArray, projectId);
  },
});
