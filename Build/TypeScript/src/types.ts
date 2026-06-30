export type ScanEngine = 'axe' | 'htmlcs';
export type Responsibility = 'editor' | 'developer' | 'unknown';

export interface ContentMetadataItem {
  uid: number;
  CType: string;
  colPos: number;
  header: string;
  bodytext: string;
}

export interface ClassificationRule {
  responsibility: Responsibility;
  hint: string;
}

export interface IssueNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface AccessibilityIssue {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: IssueNode[];
}

export interface ScanResult {
  violations: AccessibilityIssue[];
  incomplete: AccessibilityIssue[];
  passes: AccessibilityIssue[];
  url: string;
}

export interface Classification {
  responsibility: Responsibility;
  hint: string;
  contentElementUid?: number;
}

export interface ModuleSettings {
  pageUid: number;
  previewUri: string;
  contentMetadata: ContentMetadataItem[];
  axeJsUrl: string;
  htmlcsJsUrl: string;
  classificationRules: Record<string, ClassificationRule>;
}
