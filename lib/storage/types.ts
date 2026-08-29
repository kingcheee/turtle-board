// 저장 드라이버 — 동시성의 단일 원천은 CAS(compare-and-set)다.
// fs 드라이버는 프로미스 큐 안에서 버전 비교로, supabase 드라이버는 조건부 UPDATE로 구현한다.
export interface CasWrite {
  name: string;
  expectedVersion: string;
  next: string;
  nextVersion: string;
}

export interface StorageDriver {
  list(): Promise<string[]>;
  /** 없으면 NotFoundError */
  readRaw(name: string): Promise<string>;
  /** 버전 불일치 → VersionConflictError */
  casWrite(w: CasWrite): Promise<{ version: string }>;
  /** 보드 간 이동용 2보드 갱신 — dst 먼저 쓴다. 반환은 src의 새 버전 */
  casWritePair(dst: CasWrite, src: CasWrite): Promise<{ version: string }>;
  /** 이미 있으면 Error */
  create(name: string, content: string, version: string): Promise<void>;
  trash(name: string): Promise<void>;
}
