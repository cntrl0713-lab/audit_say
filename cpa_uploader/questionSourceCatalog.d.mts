export type SourceAuthority = 'official_transcription' | 'learning_material';
export type SourceKind = 'standard' | 'practice' | 'past_exam' | 'theory';
export interface SourceDependency {
  standard: string;
  paragraph: string | null;
  reason: string;
  targetId: string | null;
  appendix?: string;
  targetIds?: string[];
}
export interface SourceUnit {
  id: string;
  sourceId: string;
  topicIds: string[];
  standard: string | null;
  paragraph: string | null;
  page: number | null;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  quote: string;
  contentHash: string;
  authority: SourceAuthority;
  kind: SourceKind;
  locator: string;
  context: { section: string; sectionId: string; mappedFrom?: string };
  dependencies: SourceDependency[];
  edition: string;
  provenance: string;
  warnings: string[];
}
export interface CatalogSource {
  id: string;
  file: string;
  title: string;
  authority: SourceAuthority;
  kind: SourceKind;
  edition: string;
  provenance: string;
  contentHash: string;
  extraTopicIds: string[];
  unitIds: string[];
  topicIds: string[];
}
export interface SourceTocLink { topicId: string; file: string; pages: number[]; startLine: number }
export interface SourceTopic { id: string; title: string; keywords: string[] }
export interface SourceRegistry {
  version: number;
  editionPolicy: string;
  referenceFootnotes?: {
    file: string;
    source_hash: string;
    standard: string;
    from_paragraph: string;
    owner_paragraph: string;
    footnote_number: string;
    footnote_text: string;
    owner_callout: string;
  }[];
  topics: { id: string; standards: string[]; defaultSource: { standard: string; paragraph: string }; priorityReason?: string }[];
  coherenceGroups: { standard: string; paragraphs: string[]; reason: string }[];
  topic19: { file: string; metadataFile: string; sections: { prefix: string; standard: string; metadataName?: string; metadataUrlIncludes?: string; warning?: string }[] };
}
export interface SourceCatalog {
  version: string;
  registry: SourceRegistry;
  sources: CatalogSource[];
  units: SourceUnit[];
  tocLinks: SourceTocLink[];
  topics: SourceTopic[];
  warnings: string[];
  fingerprint: string;
}
export interface PacketSourceRef {
  id: string;
  file: string;
  title: string;
  page: string;
  source_quote: string;
  content_hash: string;
  role: 'standard' | 'practice';
  source_span: string;
}
export interface SourcePacket {
  topicId: string;
  primary: SourceUnit[];
  dependencies: SourceUnit[];
  supporting: SourceUnit[];
  units: SourceUnit[];
  sourceRefs: PacketSourceRef[];
  warnings: string[];
  unresolved: (SourceDependency & { sourceId: string })[];
  completeness: 'complete' | 'unresolved';
  completenessScope: 'parsed_references';
  charCount: number;
  quoteChars: number;
  maxChars: number;
  fingerprint: string;
}
export const SOURCE_CATALOG_VERSION: string;
export interface SourcePacketOptions { repoDir?: string; topicId: string; sourceIds?: string[]; maxChars?: number; catalog?: SourceCatalog; includeSectionContext?: boolean }
export function parseSourceToc(text: string): { topics: SourceTopic[]; links: SourceTocLink[] };
export function buildSourceCatalog(options?: { repoDir?: string }): SourceCatalog;
export function sourceUnitToRef(unit: SourceUnit): PacketSourceRef;
export function createSourcePacket(options: SourcePacketOptions): SourcePacket;
