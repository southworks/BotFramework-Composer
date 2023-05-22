// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { useRef } from 'react';
import { useRecoilValue } from 'recoil';

import { dialogsSelectorFamily, luFilesSelectorFamily, localeState, qnaFilesSelectorFamily } from '../recoilModel';
import lgWorker from '../recoilModel/parsers/lgWorker';

export const useResolvers = (projectId: string) => {
  const dialogs = useRecoilValue(dialogsSelectorFamily(projectId));
  const luFiles = useRecoilValue(luFilesSelectorFamily(projectId));
  const locale = useRecoilValue(localeState(projectId));
  const qnaFiles = useRecoilValue(qnaFilesSelectorFamily(projectId));

  const localeRef = useRef(locale);
  localeRef.current = locale;

  const luFilesRef = useRef(luFiles);
  luFilesRef.current = luFiles;

  const qnaFilesRef = useRef(qnaFiles);
  qnaFilesRef.current = qnaFiles;

  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;

  const lgFileResolver = async (id: string) => {
    const fileId = id.includes('.') ? id : `${id}.${localeRef.current}`;
    const lgFile = await lgWorker.get(projectId, fileId);
    console.log('useResolver: ' + lgFile);
    return lgFile;
  };

  const luFileResolver = (id: string) => {
    const fileId = id.includes('.') ? id : `${id}.${localeRef.current}`;
    return luFilesRef.current.find(({ id }) => id === fileId);
  };

  const dialogResolver = (dialogId: string) => {
    return dialogsRef.current.find(({ id }) => id === dialogId);
  };

  const qnaFileResolver = (id: string) => {
    const fileId = id.includes('.') ? id : `${id}.${localeRef.current}`;
    return qnaFilesRef.current.find(({ id }) => id === fileId);
  };

  return {
    luFileResolver,
    lgFileResolver,
    qnaFileResolver,
    dialogResolver,
  };
};
