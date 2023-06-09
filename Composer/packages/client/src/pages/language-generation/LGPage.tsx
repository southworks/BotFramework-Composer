// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/react';
import React, { Fragment, useCallback, Suspense, useEffect, useState } from 'react';
import formatMessage from 'format-message';
import { ActionButton } from '@fluentui/react/lib/Button';
import { RouteComponentProps, Router } from '@reach/router';
import { useRecoilState, useRecoilValue } from 'recoil';
import { LgFile } from '@botframework-composer/types';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { navigateTo } from '../../utils/navigation';
import { Page } from '../../components/Page';
import { lgFileState, lgFilesSelectorFamily, localeState } from '../../recoilModel';
import TelemetryClient from '../../telemetry/TelemetryClient';
import lgWorker from '../../recoilModel/parsers/lgWorker';

import TableView from './table-view';
const CodeEditor = React.lazy(() => import('./code-editor'));

const LGPage: React.FC<RouteComponentProps<{
  dialogId: string;
  projectId: string;
  skillId: string;
  lgFileId: string;
}>> = (props) => {
  const { dialogId = '', projectId = '', skillId, lgFileId = '' } = props;
  const [activeFile, setActiveFile] = useState();
  const actualProjectId = skillId ?? projectId;
  const locale = useRecoilValue(localeState(actualProjectId));
  const lgFiles = useRecoilValue(lgFilesSelectorFamily(skillId ?? projectId));
  // const [currentLg, setCurrentLg] = useRecoilState(
  //   lgFileState({ projectId: actualProjectId, lgFileId: `${dialogId}.${locale}` })
  // );
  const path = props.location?.pathname ?? '';

  const edit = /\/edit(\/)?$/.test(path);

  const baseURL = skillId == null ? `/bot/${projectId}/` : `/bot/${projectId}/skill/${skillId}/`;

  const getLgFileId = () =>
    lgFileId
      ? lgFiles.find(({ id }) => id === lgFileId || id === `${lgFileId}.${locale}`)
      : lgFiles.find(({ id }) => id === dialogId || id === `${dialogId}.${locale}`);

  //const getLgFileId = () => (lgFileId ? `${lgFileId}.${locale}` : `${dialogId}.${locale}`);

  // const getActiveFile = () => {
  //   let file: LgFile | undefined;
  //   console.log('LGPage-activeFile');
  //   if (lgFileId) {
  //     file = lgFiles.find(({ id }) => id === lgFileId || id === `${lgFileId}.${locale}`);
  //   } else {
  //     file = lgFiles.find(({ id }) => id === dialogId || id === `${dialogId}.${locale}`);
  //   }
  //   console.log('file?.isContentUnparsed: ' + file?.isContentUnparsed);
  //   if (file?.isContentUnparsed) {
  //     //parse, set and return
  //     lgWorker.parse(actualProjectId, currentLg.id, currentLg.content, lgFiles).then((result) => {
  //       setCurrentLg(result as LgFile);
  //       console.log('parsed lg: ' + currentLg.id);
  //       return currentLg;
  //     });
  //   }
  //   console.log('lg: ' + file?.id);
  //   return file;
  // };

  // const activeFile = getActiveFile();
  // console.log('activeFile: ' + activeFile?.id);

  useEffect(() => {
    //   if (!activeFile && lgFiles.length) {
    //     navigateTo(`${baseURL}language-generation/common`);
    //   }
    // }, [dialogId, lgFiles, projectId, lgFileId]);
    (async () => {
      const file = getLgFileId();
      if (file?.isContentUnparsed) {
        //parse, set and return
        const lgFile = await lgWorker.parse(actualProjectId, file.id, file.content, lgFiles);
        console.log('lgpage: ', lgFile);
        const commonPath = `${baseURL}language-generation/common`;
        if (!lgFile && path !== commonPath) {
          navigateTo(commonPath);
        }
        setActiveFile(lgFile);
      } else {
        setActiveFile(file as any);
      }
    })();
  }, [dialogId, lgFiles, projectId, lgFileId]);

  const onToggleEditMode = useCallback(
    (_e) => {
      let url = `${baseURL}language-generation/${dialogId}`;
      if (lgFileId) url += `/item/${lgFileId}`;
      if (!edit) url += `/edit`;
      navigateTo(url);
      TelemetryClient.track('EditModeToggled', { jsonView: !edit });
    },
    [dialogId, projectId, edit, lgFileId, baseURL]
  );

  const onRenderHeaderContent = () => {
    return (
      <ActionButton data-testid="showcode" onClick={onToggleEditMode}>
        {edit ? formatMessage('Hide code') : formatMessage('Show code')}
      </ActionButton>
    );
  };

  return (
    <Page
      showCommonLinks
      useNewTree
      data-testid="LGPage"
      dialogId={dialogId}
      fileId={lgFileId}
      mainRegionName={formatMessage('LG editor')}
      navRegionName={formatMessage('LG Navigation Pane')}
      pageMode={'language-generation'}
      projectId={projectId}
      skillId={skillId}
      title={formatMessage('Bot Responses')}
      toolbarItems={[]}
      onRenderHeaderContent={onRenderHeaderContent}
    >
      <Suspense fallback={<LoadingSpinner />}>
        <Router component={Fragment} primary={false}>
          <CodeEditor
            dialogId={dialogId}
            file={activeFile}
            lgFileId={lgFileId}
            path="/edit/*"
            projectId={projectId}
            skillId={skillId}
          />
          <TableView
            dialogId={dialogId}
            file={activeFile}
            lgFileId={lgFileId}
            path="/"
            projectId={projectId}
            skillId={skillId}
          />
        </Router>
      </Suspense>
    </Page>
  );
};

export default LGPage;
