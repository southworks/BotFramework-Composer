// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/react';
import React, { Fragment, useCallback, Suspense, useEffect, useState } from 'react';
import formatMessage from 'format-message';
import { ActionButton } from '@fluentui/react/lib/Button';
import { RouteComponentProps, Router } from '@reach/router';
import { useRecoilValue } from 'recoil';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { navigateTo } from '../../utils/navigation';
import { Page } from '../../components/Page';
import { localeState } from '../../recoilModel';
import TelemetryClient from '../../telemetry/TelemetryClient';

import TableView from './table-view';
import lgWorker from '../../recoilModel/parsers/lgWorker';
const CodeEditor = React.lazy(() => import('./code-editor'));

const LGPage: React.FC<RouteComponentProps<{
  dialogId: string;
  projectId: string;
  skillId: string;
  lgFileId: string;
}>> = (props) => {
  const { dialogId = '', projectId = '', skillId, lgFileId = '' } = props;
  const actualProjectId = skillId ?? projectId;
  const [activeFile, setActiveFile] = useState();
  const locale = useRecoilValue(localeState(actualProjectId));

  const path = props.location?.pathname ?? '';

  const edit = /\/edit(\/)?$/.test(path);

  const baseURL = skillId == null ? `/bot/${projectId}/` : `/bot/${projectId}/skill/${skillId}/`;

  const getLgFileId = () => (lgFileId ? `${lgFileId}.${locale}` : `${dialogId}.${locale}`);

  useEffect(() => {
    (async () => {
      const id = getLgFileId();
      const lgFile = await lgWorker.get(projectId, id);
      console.log('lgpage: ', lgFile);
      const commonPath = `${baseURL}language-generation/common`;
      if (!lgFile && path !== commonPath) {
        navigateTo(commonPath);
      }
      setActiveFile(lgFile);
    })();
  }, [actualProjectId, getLgFileId, activeFile]);

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
