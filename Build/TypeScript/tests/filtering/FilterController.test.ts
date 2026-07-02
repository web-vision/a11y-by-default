import { FilterController } from '../../src/filtering/FilterController';

describe('FilterController.applyFilters', () => {
  let container: HTMLElement;
  let filterController: FilterController;

  beforeEach(() => {
    filterController = new FilterController();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function appendFilterCheckboxes(overrides: Partial<Record<string, boolean>> = {}): void {
    const activeView = overrides['developer'] === true ? 'developer' : 'editor';
    const filters = document.createElement('div');
    filters.innerHTML = `
      <input type="checkbox" class="a11y-filter-severity" value="critical" ${overrides['critical'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="serious" ${overrides['serious'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="moderate" ${overrides['moderate'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="minor" ${overrides['minor'] !== false ? 'checked' : ''}>
      <button type="button" role="tab" data-view="editor" aria-selected="${String(activeView === 'editor')}"></button>
      <button type="button" role="tab" data-view="developer" aria-selected="${String(activeView === 'developer')}"></button>`;
    document.body.appendChild(filters);
  }

  it('hides the whole severity group when its severity checkbox is unchecked', () => {
    appendFilterCheckboxes({ minor: false });
    container.innerHTML = `
      <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
      <div data-severity-group="minor"><div data-impact="minor" data-responsibility="editor"></div></div>`;

    filterController.applyFilters(container);

    const groups = container.querySelectorAll('[data-severity-group]');
    expect(groups[0]?.classList.contains('d-none')).toBe(false);
    expect(groups[1]?.classList.contains('d-none')).toBe(true);
  });

  it('hides developer-responsibility tasks on the editor tab so editors only see editor tasks', () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical">
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    filterController.applyFilters(container);

    const tasks = container.querySelectorAll('[data-impact]');
    expect(tasks[0]?.classList.contains('d-none')).toBe(false);
    expect(tasks[1]?.classList.contains('d-none')).toBe(true);
  });

  it('shows only developer-responsibility tasks once the developer tab is active', () => {
    appendFilterCheckboxes({ developer: true });
    container.innerHTML = `
      <div data-severity-group="critical">
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    filterController.applyFilters(container);

    const tasks = container.querySelectorAll('[data-impact]');
    expect(tasks[0]?.classList.contains('d-none')).toBe(true);
    expect(tasks[1]?.classList.contains('d-none')).toBe(false);
  });

  it('hides a severity group entirely once every task inside it is filtered out by the active view', () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical"><div data-impact="critical" data-responsibility="developer"></div></div>`;

    filterController.applyFilters(container);

    expect(container.querySelector('[data-severity-group]')?.classList.contains('d-none')).toBe(true);
  });

  it("updates each severity group's own count badge to the number of currently visible tasks", () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical">
        <span data-severity-group-count>2</span>
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    filterController.applyFilters(container);

    expect(container.querySelector('[data-severity-group-count]')?.textContent).toBe('1');
  });

  it('updates the violations and needs-review badge counts to reflect only visible tasks', () => {
    appendFilterCheckboxes({ minor: false });
    container.innerHTML = `
      <section aria-labelledby="a11y-violations-heading">
        <h2><span id="a11y-violations-count">2</span></h2>
        <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
        <div data-severity-group="minor"><div data-impact="minor" data-responsibility="editor"></div></div>
      </section>
      <section aria-labelledby="a11y-incomplete-heading">
        <h2><span id="a11y-incomplete-count">1</span></h2>
        <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
      </section>`;

    filterController.applyFilters(container);

    expect(document.getElementById('a11y-violations-count')?.textContent).toBe('1');
    expect(document.getElementById('a11y-incomplete-count')?.textContent).toBe('1');

    (document.querySelector('.a11y-filter-severity[value="minor"]') as HTMLInputElement).checked = true;
    filterController.applyFilters(container);

    expect(document.getElementById('a11y-violations-count')?.textContent).toBe('2');
  });
});

describe('FilterController.updateFilterCounts', () => {
  let container: HTMLElement;
  let filterController: FilterController;

  beforeEach(() => {
    filterController = new FilterController();
    container = document.createElement('div');
    document.body.appendChild(container);

    const filterButtons = document.createElement('div');
    filterButtons.innerHTML = `
      <input type="checkbox" id="a11y-filter-severity-critical">
      <span data-severity-count="critical">0</span>
      <input type="checkbox" id="a11y-filter-severity-serious">
      <span data-severity-count="serious">0</span>
      <input type="checkbox" id="a11y-filter-severity-moderate">
      <span data-severity-count="moderate">0</span>
      <input type="checkbox" id="a11y-filter-severity-minor">
      <span data-severity-count="minor">0</span>
      <span data-view-count="editor">0</span>
      <span data-view-count="developer">0</span>`;
    document.body.appendChild(filterButtons);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('counts found issues per severity', () => {
    container.innerHTML = `
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="minor" data-responsibility="editor"></div>`;

    filterController.updateFilterCounts(container);

    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('2');
    expect(document.querySelector('[data-severity-count="serious"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-severity-count="minor"]')?.textContent).toBe('1');
  });

  it('counts editor issues and non-editor issues separately for the view tabs', () => {
    container.innerHTML = `
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="serious" data-responsibility="developer"></div>
      <div class="card" data-impact="moderate" data-responsibility="unknown"></div>`;

    filterController.updateFilterCounts(container);

    expect(document.querySelector('[data-view-count="editor"]')?.textContent).toBe('1');
    expect(document.querySelector('[data-view-count="developer"]')?.textContent).toBe('2');
  });

  it('disables severity filter buttons that have zero findings', () => {
    container.innerHTML = '<div class="card" data-impact="critical" data-responsibility="editor"></div>';

    filterController.updateFilterCounts(container);

    expect((document.getElementById('a11y-filter-severity-critical') as HTMLInputElement).disabled).toBe(false);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(true);
  });

  it('re-enables a severity filter button once matching findings appear again', () => {
    container.innerHTML = '';
    filterController.updateFilterCounts(container);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(true);

    container.innerHTML = '<div class="card" data-impact="minor" data-responsibility="editor"></div>';
    filterController.updateFilterCounts(container);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(false);
  });

  it('scopes severity counts to the active view tab instead of counting all findings', () => {
    const tabs = document.createElement('div');
    tabs.innerHTML = `
      <button role="tab" data-view="editor" aria-selected="true"></button>
      <button role="tab" data-view="developer" aria-selected="false"></button>`;
    document.body.appendChild(tabs);

    container.innerHTML = `
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="minor" data-responsibility="developer"></div>
      <div class="card" data-impact="minor" data-responsibility="developer"></div>`;

    filterController.updateFilterCounts(container);

    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('1');
    expect(document.querySelector('[data-severity-count="minor"]')?.textContent).toBe('0');

    (tabs.querySelector('[data-view="editor"]') as HTMLElement).setAttribute('aria-selected', 'false');
    (tabs.querySelector('[data-view="developer"]') as HTMLElement).setAttribute('aria-selected', 'true');
    filterController.updateFilterCounts(container);

    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-severity-count="minor"]')?.textContent).toBe('2');
  });

  it('strips the color from a severity button once it is disabled, so it no longer looks clickable', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'a11y-filter-severity-minor');
    label.className = 'btn btn-sm btn-secondary';
    label.dataset['btnClass'] = 'btn-secondary';
    document.body.appendChild(label);
    (document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).checked = true;

    container.innerHTML = '';
    filterController.updateFilterCounts(container);

    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(true);
    expect(label.classList.contains('btn-secondary')).toBe(false);
    expect(label.classList.contains('btn-default')).toBe(true);
  });
});
