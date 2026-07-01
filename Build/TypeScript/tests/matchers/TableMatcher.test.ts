import type { ContentFactsIndex } from '../../src/ContentFacts';
import { matchTable } from '../../src/matchers/TableMatcher';

function makeIndex(tables: ContentFactsIndex['tables']): ContentFactsIndex {
  return { headings: [], links: [], images: [], tables };
}

function tableWithCells(cells: string[]): HTMLTableElement {
  const table = document.createElement('table');
  table.innerHTML = `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  return table;
}

describe('matchTable', () => {
  it('matches when the live table cell texts overlap sufficiently with a known table', () => {
    const table = tableWithCells(['Name', 'Age', 'City']);
    const index = makeIndex([{ cellTexts: ['Name', 'Age', 'City'], contentElementUid: 60 }]);
    expect(matchTable(table, index)).toBe(60);
  });

  it('matches with minor differences tolerated by the overlap threshold', () => {
    const table = tableWithCells(['Name', 'Age', 'City', 'Extra Cell Not In Source']);
    const index = makeIndex([{ cellTexts: ['Name', 'Age', 'City'], contentElementUid: 60 }]);
    expect(matchTable(table, index)).toBe(60);
  });

  it('returns undefined when no known table overlaps enough', () => {
    const table = tableWithCells(['Departure', 'Arrival', 'Duration']);
    const index = makeIndex([{ cellTexts: ['Name', 'Age', 'City'], contentElementUid: 60 }]);
    expect(matchTable(table, index)).toBeUndefined();
  });

  it('returns undefined for a table with no cell text', () => {
    const table = document.createElement('table');
    const index = makeIndex([{ cellTexts: ['Name', 'Age'], contentElementUid: 60 }]);
    expect(matchTable(table, index)).toBeUndefined();
  });
});
