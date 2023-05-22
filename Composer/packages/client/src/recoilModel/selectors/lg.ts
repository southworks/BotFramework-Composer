// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { LgFile } from '@bfc/shared';
import { selectorFamily } from 'recoil';
import { filterCustomFunctionError } from '@bfc/indexers/lib/utils/lgUtil';

import { lgFileIdsState, lgFileState, settingsState } from '../atoms';
// import { cache } from '../parsers/workers/lgParser.worker';

export const lgFilesSelectorFamily = selectorFamily<LgFile[], string>({
  key: 'lgFiles',
  get: (projectId: string) => ({ get }) => {
    const lgFileIds = get(lgFileIdsState(projectId));
    const settings = get(settingsState(projectId));
    // const lgFiles = (await cache?.db.projects.where(projectId).anyOf(lgFileIds).toArray()) ?? [];
    // console.log(lgFiles?.length)
    // return lgFiles.map((lgFile) => {
    //   const diagnostics = filterCustomFunctionError(lgFile.diagnostics, settings?.customFunctions ?? []);
    //   return { ...lgFile, diagnostics };
    // });

    return lgFileIds.map((lgFileId) => {
      const lgFile = get(lgFileState({ projectId, lgFileId }));
      const diagnostics = filterCustomFunctionError(lgFile.diagnostics, settings?.customFunctions ?? []);
      return { ...lgFile, diagnostics };
    });
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
