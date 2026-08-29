export type Priority = '🔴' | '🟡' | '🟢';

export interface CardBlock { lines: string[] }

export interface ColumnBlock {
  title: string;
  gapBefore: string[];
  cards: CardBlock[];
  gapAfter: string[];
}

export interface BoardDoc {
  eol: '\n' | '\r\n';
  prelude: string[];
  columns: ColumnBlock[];
  trailer: string[];
}

export interface CardMeta {
  checked: boolean;
  priority: Priority | null;
  title: string;
  due: string | null;
  doneDate: string | null;
  assignees: string[];
  createdAt: string | null;
  updatedAt: string | null;
  description: string;
}

export interface UiCard { raw: string; meta: CardMeta }
export interface UiColumn { title: string; cards: UiCard[] }
export interface UiBoard { name: string; version: string; columns: UiColumn[] }
