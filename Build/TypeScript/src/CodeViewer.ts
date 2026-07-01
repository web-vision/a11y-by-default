import { EditorView, highlightSpecialChars } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

const TAG_NAME = 'a11y-code-viewer';
const STYLE_ID = 'a11y-code-viewer-style';

// TYPO3's own <typo3-t3editor-codemirror> only exposes a `readonly` flag,
// which still leaves the field focusable with a blinking caret and focus
// ring — it reads as a disabled editor rather than a code display. Building
// directly on the CodeMirror packages TYPO3's backend already loads via its
// importmap (see EXT:backend Configuration/JavaScriptModules.php) lets us
// combine EditorState.readOnly with EditorView.editable(false), which drops
// the caret entirely instead of just rejecting edits.
class A11yCodeViewer extends HTMLElement {
  private view: EditorView | null = null;
  private observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    if (this.view !== null) {
      return;
    }

    injectStyles();

    if (typeof IntersectionObserver === 'undefined') {
      this.mount();
      return;
    }

    // Issue snippets sit inside collapsed accordion panels (zero height until
    // expanded), so mount lazily on first visibility instead of paying for a
    // CodeMirror instance per hidden issue. Matches the observer pattern
    // TYPO3 core itself uses for lazy-loaded code editors.
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.intersectionRatio > 0)) {
          this.mount();
        }
      },
      { root: document.body },
    );
    this.observer.observe(this);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.view?.destroy();
    this.view = null;
  }

  private mount(): void {
    this.observer?.disconnect();
    this.observer = null;

    const source = this.textContent ?? '';
    this.textContent = '';

    this.view = new EditorView({
      parent: this,
      state: EditorState.create({
        doc: source,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          highlightSpecialChars(),
          html(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        ],
      }),
    });
  }
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ${TAG_NAME} {
      display: block;
      margin-bottom: .25rem;
    }
    ${TAG_NAME} .cm-editor {
      border: var(--typo3-input-border-width, 1px) solid var(--typo3-input-border-color, #b3b3b3);
      border-radius: var(--typo3-input-border-radius, .25rem);
      font-size: .8125rem;
    }
    ${TAG_NAME} .cm-scroller {
      max-height: 12rem;
    }
  `;
  document.head.appendChild(style);
}

if (customElements.get(TAG_NAME) === undefined) {
  customElements.define(TAG_NAME, A11yCodeViewer);
}
