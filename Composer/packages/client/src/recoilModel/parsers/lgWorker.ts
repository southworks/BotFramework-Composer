// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { LgFile, LgTemplate, TextFile } from '@bfc/shared';

import Worker from './workers/lgParser.worker.ts';
import { BaseWorker } from './baseWorker';
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
  LgGetlPayload,
} from './types';

// Wrapper class
class LgWorker extends BaseWorker<LgActionType> {
  get(projectId: string, id?: string): Promise<any> {
    return this.sendMsg<LgGetlPayload>(LgActionType.Get, { projectId, id });
  }

  async addProject(projectId: string) {
    return await this.sendMsg<LgNewCachePayload>(LgActionType.NewCache, { projectId });
  }

  async removeProject(projectId: string) {
    return await this.sendMsg<LgCleanCachePayload>(LgActionType.CleanCache, { projectId });
  }

  async parse(projectId: string, id: string, content: string, lgFiles: LgFile[]): Promise<any> {
    return await this.sendMsg<LgParsePayload>(LgActionType.Parse, { id, content, lgFiles, projectId });
  }

  async parseAll(projectId: string, lgResources: TextFile[]) {
    return await this.sendMsg<LgParseAllPayload>(LgActionType.ParseAll, { lgResources, projectId });
  }

  async addTemplate(projectId: string, lgFile: LgFile, template: LgTemplate, lgFiles: LgFile[]) {
    return await this.sendMsg<LgCreateTemplatePayload>(LgActionType.AddTemplate, {
      lgFile,
      template,
      lgFiles,
      projectId,
    });
  }

  async addTemplates(projectId: string, lgFile: LgFile, templates: LgTemplate[], lgFiles: LgFile[]) {
    return await this.sendMsg<LgCreateTemplatesPayload>(LgActionType.AddTemplates, {
      lgFile,
      templates,
      lgFiles,
      projectId,
    });
  }

  async updateTemplate(
    projectId: string,
    lgFile: LgFile,
    templateName: string,
    template: { name?: string; parameters?: string[]; body?: string },
    lgFiles: LgFile[]
  ) {
    return await this.sendMsg<LgUpdateTemplatePayload>(LgActionType.UpdateTemplate, {
      lgFile,
      templateName,
      template,
      lgFiles,
      projectId,
    });
  }

  async removeTemplate(projectId: string, lgFile: LgFile, templateName: string, lgFiles: LgFile[]) {
    return await this.sendMsg<LgRemoveTemplatePayload>(LgActionType.RemoveTemplate, {
      lgFile,
      templateName,
      lgFiles,
      projectId,
    });
  }

  async removeTemplates(projectId: string, lgFile: LgFile, templateNames: string[], lgFiles: LgFile[]) {
    return await this.sendMsg<LgRemoveAllTemplatesPayload>(LgActionType.RemoveAllTemplates, {
      lgFile,
      templateNames,
      lgFiles,
      projectId,
    });
  }

  async copyTemplate(
    projectId: string,
    lgFile: LgFile,
    fromTemplateName: string,
    toTemplateName: string,
    lgFiles: LgFile[]
  ) {
    return await this.sendMsg<LgCopyTemplatePayload>(LgActionType.CopyTemplate, {
      lgFile,
      fromTemplateName,
      toTemplateName,
      lgFiles,
      projectId,
    });
  }
}

export default new LgWorker(new Worker());
