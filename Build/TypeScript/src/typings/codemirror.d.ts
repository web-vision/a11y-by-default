// TYPO3's backend module exposes these CodeMirror packages via its browser
// importmap (see EXT:backend Configuration/JavaScriptModules.php) rather than
// as npm packages, so `npm install` can't provide their types. These ambient
// declarations cover only the surface CodeViewer.ts actually consumes.

declare module '@codemirror/state' {
  export interface StateFacet<T> {
    of(value: T): unknown;
  }

  export class EditorState {
    static create(config: { doc?: string; extensions?: unknown[] }): EditorState;
    static readonly readOnly: StateFacet<boolean>;
  }
}

declare module '@codemirror/view' {
  import type { EditorState } from '@codemirror/state';

  export class EditorView {
    constructor(config: { parent: Element; state: EditorState });
    destroy(): void;
    static readonly editable: { of(value: boolean): unknown };
    static readonly lineWrapping: unknown;
  }

  export function highlightSpecialChars(): unknown;
}

declare module '@codemirror/lang-html' {
  export function html(): unknown;
}

declare module '@codemirror/language' {
  export function syntaxHighlighting(style: unknown, options?: { fallback?: boolean }): unknown;
  export const defaultHighlightStyle: unknown;
}
