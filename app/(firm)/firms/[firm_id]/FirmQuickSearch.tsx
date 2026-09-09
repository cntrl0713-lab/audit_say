'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';

interface FirmQuickSearchProps {
    firms: readonly { firm_id: number; firm_name: string }[];
    currentFirmId: number;
}

/** 법인 목록 검색과 같은 공백·대소문자 처리다. */
function normalize(value: string): string {
    return value.replace(/\s/g, '').toLocaleLowerCase('ko');
}

export default function FirmQuickSearch({ firms, currentFirmId }: FirmQuickSearchProps) {
    const router = useRouter();
    const id = useId();
    const listId = `${id}-results`;
    const helpId = `${id}-help`;
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const composing = useRef(false);
    const optionRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const search = normalize(query);
    const matches = search
        ? firms.filter(firm => firm.firm_id !== currentFirmId && normalize(firm.firm_name).includes(search))
            .sort((a, b) => a.firm_name.localeCompare(b.firm_name, 'ko'))
        : [];
    const suggestions = matches.slice(0, 8);
    const showResults = open && search.length > 0;
    const activeFirm = showResults ? suggestions[activeIndex] : undefined;

    useEffect(() => {
        if (showResults && activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }, [showResults, activeIndex]);

    function close() {
        setOpen(false);
        setActiveIndex(-1);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        // 한국어 조합 확정 Enter는 검색 결과 이동으로 처리하지 않는다. 229는 일부 브라우저의 IME 키 코드다.
        if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === 'Escape') {
            if (showResults) event.preventDefault();
            close();
            return;
        }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(index => !showResults || index < 0
                ? step === 1 ? 0 : suggestions.length - 1
                : (index + step + suggestions.length) % suggestions.length);
            return;
        }
        if (event.key === 'Enter' && showResults && suggestions.length > 0) {
            event.preventDefault();
            const selected = activeFirm ?? suggestions[0];
            close();
            setQuery('');
            router.push(`/firms/${selected.firm_id}`);
        }
    }

    return (
        <div
            className="relative min-w-0 w-full"
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) close();
            }}
        >
            <label htmlFor={id} className="sr-only">다른 회계법인 검색</label>
            <div className="relative">
                <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
                <input
                    id={id}
                    type="search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showResults}
                    aria-controls={showResults ? listId : undefined}
                    aria-activedescendant={activeFirm ? `${id}-firm-${activeFirm.firm_id}` : undefined}
                    aria-describedby={helpId}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="go"
                    placeholder="다른 회계법인 검색"
                    value={query}
                    onChange={event => {
                        setQuery(event.target.value);
                        setActiveIndex(-1);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => { composing.current = true; }}
                    onCompositionEnd={() => { composing.current = false; }}
                    className="min-h-11 w-full min-w-0 rounded-lg border border-card-border bg-card py-2 pl-10 pr-3 text-base text-foreground placeholder:text-foreground/55 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>
            <p id={helpId} className="sr-only">법인명을 입력하고 위아래 방향키로 결과를 선택한 뒤 Enter를 누르세요. 현재 법인은 검색 결과에서 제외됩니다.</p>
            {showResults ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-card-border bg-card shadow-lg">
                    <p role="status" className="border-b border-card-border px-3 py-2.5 text-[13px] text-foreground/65">
                        {matches.length > 0
                            ? matches.length > 8 ? `검색 결과 ${matches.length}곳 · 8곳 표시` : `검색 결과 ${matches.length}곳`
                            : '일치하는 다른 회계법인이 없습니다.'}
                    </p>
                    <ul id={listId} role="listbox" aria-label="회계법인 검색 결과" className="p-1">
                        {suggestions.map((firm, index) => (
                            <li key={firm.firm_id} role="presentation">
                                <Link
                                    ref={element => { optionRefs.current[index] = element; }}
                                    id={`${id}-firm-${firm.firm_id}`}
                                    href={`/firms/${firm.firm_id}`}
                                    role="option"
                                    aria-selected={activeIndex === index}
                                    tabIndex={-1}
                                    onMouseDown={event => {
                                        // 입력 포커스를 유지해 결과 클릭 전에 blur로 목록이 사라지는 것을 막는다.
                                        if (event.button === 0) event.preventDefault();
                                    }}
                                    onPointerMove={() => setActiveIndex(index)}
                                    onNavigate={() => {
                                        close();
                                        setQuery('');
                                    }}
                                    className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${activeIndex === index ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-background'}`}
                                >
                                    <span className="min-w-0 break-words">{firm.firm_name}</span>
                                    <ArrowUpRight aria-hidden="true" size={16} className="shrink-0 opacity-60" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {matches.length === 0 || matches.length > 8 ? (
                        <p className="px-3 pb-3 text-[13px] leading-relaxed text-foreground/65">
                            {matches.length === 0 ? '법인명을 확인하거나 짧게 입력해보세요.' : '법인명을 더 입력하면 결과를 좁힐 수 있어요.'}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
