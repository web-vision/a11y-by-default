// CodeViewer.ts imports these bare specifiers expecting TYPO3 backend's
// browser importmap to resolve them (see EXT:backend
// Configuration/JavaScriptModules.php) — they aren't installable npm
// packages here, so jest.config.cjs maps every `@codemirror/*` import to
// this single stub instead.

export class EditorView {
  destroy(): void {}

  static editable = { of: (): undefined => undefined };
  static lineWrapping = undefined;
}

export function highlightSpecialChars(): undefined {
  return undefined;
}

export class EditorState {
  static create(): Record<string, unknown> {
    return {};
  }

  static readOnly = { of: (): undefined => undefined };
}

export function html(): undefined {
  return undefined;
}

export function syntaxHighlighting(): undefined {
  return undefined;
}

export const defaultHighlightStyle = undefined;
