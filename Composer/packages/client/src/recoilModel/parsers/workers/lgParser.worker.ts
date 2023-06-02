// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { lgUtil } from '@bfc/indexers';
import { lgImportResolverGenerator, LgFile, TextFile } from '@bfc/shared';

import {
  LgActionType,
  LgParsePayload,
  LgUpdateTemplatePayload,
  LgCreateTemplatePayload,
  LgCreateTemplatesPayload,
  LgRemoveTemplatePayload,
  LgRemoveAllTemplatesPayload,
  LgCopyTemplatePayload,
  LgNewCachePayload,
  LgCleanCachePayload,
  LgParseAllPayload,
} from '../types';

const ctx: Worker = self as any;

interface ParseMessage {
  id: string;
  type: LgActionType.Parse;
  payload: LgParsePayload;
}

interface AddMessage {
  id: string;
  type: LgActionType.AddTemplate;
  payload: LgCreateTemplatePayload;
}

interface AddsMessage {
  id: string;
  type: LgActionType.AddTemplates;
  payload: LgCreateTemplatesPayload;
}

interface UpdateMessage {
  id: string;
  type: LgActionType.UpdateTemplate;
  payload: LgUpdateTemplatePayload;
}

interface RemoveMessage {
  id: string;
  type: LgActionType.RemoveTemplate;
  payload: LgRemoveTemplatePayload;
}

interface RemoveAllMessage {
  id: string;
  type: LgActionType.RemoveAllTemplates;
  payload: LgRemoveAllTemplatesPayload;
}

interface CopyMessage {
  id: string;
  type: LgActionType.CopyTemplate;
  payload: LgCopyTemplatePayload;
}

interface CopyMessage {
  id: string;
  type: LgActionType.CopyTemplate;
  payload: LgCopyTemplatePayload;
}

interface NewCacheMessage {
  id: string;
  type: LgActionType.NewCache;
  payload: LgNewCachePayload;
}

interface CleanCacheMeassage {
  id: string;
  type: LgActionType.CleanCache;
  payload: LgCleanCachePayload;
}

type ParseAllMessage = {
  id: string;
  type: LgActionType.ParseAll;
  payload: LgParseAllPayload;
};

type LgMessageEvent =
  | NewCacheMessage
  | CleanCacheMeassage
  | ParseMessage
  | AddMessage
  | AddsMessage
  | UpdateMessage
  | RemoveMessage
  | RemoveAllMessage
  | CopyMessage
  | ParseAllMessage;

type LgResources = Map<string, LgFile>;

const lgFileResolver = (lgFiles) => {
  return lgImportResolverGenerator(lgFiles, '.lg');
};

export class LgCache {
  // use projectId to support multiple bots.
  projects: Map<string, LgResources> = new Map();

  public set(projectId: string, value: LgFile) {
    const lgResources = this.projects.get(projectId);

    if (!lgResources) return;

    console.log('lgCache-set: value.id: ' + value.id + ' value: ' + value);
    lgResources.set(value.id, value);
    console.log('lgResources.set done');

    //update reference resource
    const updatedResource = value.parseResult;
    lgResources.forEach((lgResource) => {
      if (lgResource.parseResult) {
        lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
          return ref.id === value.id ? updatedResource : ref;
        });
      }
    });

    this.projects.set(projectId, lgResources);
    console.log('this.projects.set done');
  }

  public get(projectId: string, fileId: string) {
    console.log('lgCache-get fileId: ' + fileId);
    const file = this.projects.get(projectId)?.get(fileId);
    console.log('lgCache-get: file.id: ' + file?.id + ' file: ' + file);
    return file;
  }

  public removeProject(projectId: string) {
    this.projects.delete(projectId);
  }

  public addProject(projectId: string) {
    const lgResources = new Map();
    this.projects.set(projectId, lgResources);
  }
}

// cache the lg parse result. For updateTemplate function,
// if we use the cache, the 12k lines file will reduce the parse time(10s -> 150ms)
export const cache = new LgCache();

const filterParseResult = (lgFile: LgFile) => {
  const cloned = { ...lgFile };
  // remove the parse tree from the result.
  // The parse tree has Int32Array type, can't be frozen by recoil
  delete cloned.parseResult;
  return cloned;
};

const getTargetFile = (projectId: string, lgFile: LgFile, lgFiles: LgFile[]) => {
  console.log('getTargetFile');
  const cachedFile = cache.get(projectId, lgFile.id);

  if (cachedFile?.isContentUnparsed) {
    console.log('isContentUnparsed');
    //parse content, set and return
    const lgFile = lgUtil.parse(cachedFile.id, cachedFile.content, lgFiles);
    lgFile.isContentUnparsed = false;
    console.log('going to set file: ' + lgFile.id + lgFile.isContentUnparsed);
    cache.set(projectId, lgFile);
    return filterParseResult(lgFile);
  }

  // Instead of compare content, just use cachedFile as single truth of fact, because all updates are supposed to be happen in worker, and worker will always update cache.
  return cachedFile ?? lgFile;
};

const emptyLgFile = (id: string, content: string): LgFile => {
  return {
    id,
    content,
    diagnostics: [],
    templates: [],
    allTemplates: [],
    imports: [],
    isContentUnparsed: true,
  };
};

export const handleMessage = (msg: LgMessageEvent) => {
  console.log('handle Message: ' + msg.type);
  let payload: any = null;
  switch (msg.type) {
    case LgActionType.NewCache: {
      const { projectId } = msg.payload;
      cache.addProject(projectId);
      break;
    }

    case LgActionType.CleanCache: {
      const { projectId } = msg.payload;
      cache.removeProject(projectId);
      break;
    }

    case LgActionType.Parse: {
      const { id, content, lgFiles, projectId } = msg.payload;

      const lgFile = lgUtil.parse(id, content, lgFiles);
      cache.set(projectId, lgFile);
      payload = filterParseResult(lgFile);
      break;
    }

    case LgActionType.ParseAll: {
      const { lgResources, projectId } = msg.payload;

      payload = lgResources.map(({ id, content }) => {
        //payload = lgResources.map((txtFile) => {
        //const lgFile = lgUtil.parse(id, content, lgResources);
        //cache.set(projectId, lgFile);
        const emptyLg = emptyLgFile(id, content);
        cache.set(projectId, emptyLg);
        //return filterParseResult(lgFile);
        return filterParseResult(emptyLg);
      });

      break;
    }

    case LgActionType.AddTemplate: {
      const { lgFile, template, lgFiles, projectId } = msg.payload;
      const result = lgUtil.addTemplate(getTargetFile(projectId, lgFile, lgFiles), template, lgFileResolver(lgFiles));
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.AddTemplates: {
      const { lgFile, templates, lgFiles, projectId } = msg.payload;
      const result = lgUtil.addTemplates(getTargetFile(projectId, lgFile, lgFiles), templates, lgFileResolver(lgFiles));
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.UpdateTemplate: {
      const { lgFile, templateName, template, lgFiles, projectId } = msg.payload;
      const result = lgUtil.updateTemplate(
        getTargetFile(projectId, lgFile, lgFiles),
        templateName,
        template,
        lgFileResolver(lgFiles)
      );
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveTemplate: {
      const { lgFile, templateName, lgFiles, projectId } = msg.payload;
      const result = lgUtil.removeTemplate(
        getTargetFile(projectId, lgFile, lgFiles),
        templateName,
        lgFileResolver(lgFiles)
      );
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveAllTemplates: {
      const { lgFile, templateNames, lgFiles, projectId } = msg.payload;
      const result = lgUtil.removeTemplates(
        getTargetFile(projectId, lgFile, lgFiles),
        templateNames,
        lgFileResolver(lgFiles)
      );
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.CopyTemplate: {
      const { lgFile, toTemplateName, fromTemplateName, lgFiles, projectId } = msg.payload;
      const result = lgUtil.copyTemplate(
        getTargetFile(projectId, lgFile, lgFiles),
        fromTemplateName,
        toTemplateName,
        lgFileResolver(lgFiles)
      );
      cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }
  }
  return payload;
};

ctx.onmessage = function (event) {
  const msg = event.data as LgMessageEvent;

  try {
    const payload = handleMessage(msg);

    ctx.postMessage({ id: msg.id, payload });
  } catch (error) {
    ctx.postMessage({ id: msg.id, error: error.message });
  }
};
