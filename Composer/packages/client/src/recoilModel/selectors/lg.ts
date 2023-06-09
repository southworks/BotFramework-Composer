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
  //get: (projectId: string) => ({ get }) => {
  get: (projectId: string) => async ({ get }) => {
    //const lgFileIds = get(lgFileIdsState(projectId));
    const settings = get(settingsState(projectId));
    // return lgFileIds.map((lgFileId) => {
    //   const lgFile = get(lgFileState({ projectId, lgFileId }));
    //   const diagnostics = filterCustomFunctionError(lgFile.diagnostics, settings?.customFunctions ?? []);
    //   return { ...lgFile, diagnostics };
    // });
    const lgFiles = await db.projects.get(projectId);
    const result: { file: LgFile; diagnostics: Diagnostic[] }[] = [];

    // for (const file of files) {
    //   const diagnostics = filterCustomFunctionError(file.diagnostics, settings?.customFunctions ?? []);
    //   result.push({ file: file, diagnostics: diagnostics });
    // }
    // return (result as unknown) as LgFile[];
    console.log('lgSelector-get lgFiles.foreach:' + lgFiles);
    lgFiles.forEach((file) => {
      //const lgFile = get(lgFileState({ projectId, lgFileId }));
      const diagnostics = filterCustomFunctionError(file.diagnostics, settings?.customFunctions ?? []);
      //return { ...file, diagnostics };
      const item = { ...file, diagnostics };
      result.push(item);
    });

    return (result as unknown) as LgFile[];

    // const result = await Promise.all(
    //   lgFileIds.map(async (lgFileId) => {
    //     //const key = projectId.concat('-', lgFileId);
    //     const file = await db.projects.get(projectId);
    //     if (file) {
    //       const diagnostics = filterCustomFunctionError(file.diagnostics, settings?.customFunctions ?? []);
    //       return { ...file, diagnostics };
    //     }
    //   })
    // );
    // return result as LgFile[];
  },
  set: (projectId: string) => ({ set }, newLgFiles) => {
    const newLgFileArray = newLgFiles as LgFile[];
    set(
      lgFileIdsState(projectId),
      newLgFileArray.map((lgFile) => lgFile.id)
    );
    newLgFileArray.forEach((lgFile) => set(lgFileState({ projectId, lgFileId: lgFile.id }), lgFile));
  },
});
