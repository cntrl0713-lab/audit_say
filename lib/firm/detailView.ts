import { readEnum, readString, type SearchParams } from './params.ts';
import { AUDIT_OPINIONS } from './types.ts';

export const FIRM_DETAIL_TABS = ['overview', 'revenue', 'clients', 'compensation', 'people'] as const;
export type FirmDetailTab = (typeof FIRM_DETAIL_TABS)[number];
export const CLIENT_VIEWS = ['list', 'opinions', 'kam'] as const;
export type ClientView = (typeof CLIENT_VIEWS)[number];

/** 기존 공유 링크를 새 정보 구조로 해석한다. 두 연도 축의 의미는 바꾸지 않는다. */
export function resolveFirmDetailView(query: SearchParams) {
    const legacy = readString(query, 'tab');
    const tab: FirmDetailTab = legacy === 'workforce' ? 'revenue'
        : legacy === 'personnel' ? 'compensation'
        : legacy === 'kam' ? 'clients'
        : readEnum(query, 'tab', FIRM_DETAIL_TABS) ?? 'overview';
    const requestedClientView: ClientView = legacy === 'kam' ? 'kam' : readEnum(query, 'client_view', CLIENT_VIEWS) ?? 'list';
    // 기존 의견 필터 링크도 선택·해제 컨트롤이 보이는 화면으로 연다.
    const clientView: ClientView = tab === 'clients' && requestedClientView === 'list'
        && readEnum(query, 'opinion', AUDIT_OPINIONS) !== undefined ? 'opinions' : requestedClientView;
    const group = tab === 'revenue' || tab === 'clients' ? 'business'
        : tab === 'compensation' || tab === 'people' ? 'internal' : 'overview';
    return { tab, clientView, group, isFirmOwnTab: tab !== 'clients' };
}
