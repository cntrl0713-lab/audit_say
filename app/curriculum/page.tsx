'use client';

import React, { useEffect, useState } from 'react';
import { getStructureData, getNormalizedQuestions } from '../actions';
import { StructureData, compareChapters } from '../../lib/utils';
import { AuditQuestion } from '../../lib/db';
import { Loading } from '../../components/Loading';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function CurriculumPage() {
    const [structure, setStructure] = useState<StructureData | null>(null);
    const [questions, setQuestions] = useState<AuditQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedParts, setExpandedParts] = useState<{ [part: string]: boolean }>({});

    useEffect(() => {
        async function loadCurriculum() {
            try {
                const struct = await getStructureData();
                const qs = await getNormalizedQuestions();
                setStructure(struct);
                setQuestions(qs);

                // Show first part as expanded by default
                const parts = Object.keys(struct.hierarchy).sort();
                if (parts.length > 0) {
                    setExpandedParts({ [parts[0]]: true });
                }
            } catch (err) {
                console.error('커리큘럼 구성 오류:', err);
            } finally {
                setLoading(false);
            }
        }
        loadCurriculum();
    }, []);

    if (loading) {
        return <Loading label="커리큘럼 불러오는 중" />;
    }

    if (!structure) {
        return (
            <div className="max-w-3xl mx-auto w-full py-8">
                <h1 className="text-xl">커리큘럼</h1>
                <p className="text-sm text-foreground/55 mt-1.5">커리큘럼을 불러오지 못했습니다.</p>
            </div>
        );
    }

    // Pre-process questions matching lookup map: part -> chapter name -> standard -> questions
    const getMappedContent = () => {
        const map: { [part: string]: { [chap: string]: { [std: string]: AuditQuestion[] } } } = {};

        questions.forEach((q) => {
            const p = String(q.part);
            const c = String(q.chapter);
            const s = String(q.standard || 'Unknown');

            // We look up full chapter/part name from structure nameMap to match the output hierarchy
            const partKey = Object.keys(structure.hierarchy).find(
                (partName) => partName.includes(p)
            ) || `PART${p}`;

            const cMatch = c.match(/\d+/);
            const cNum = cMatch ? cMatch[0] : c;

            const chapKey = Object.keys(structure.hierarchy[partKey] || {}).find(
                (cName) => {
                    const match = cName.match(/\d+/);
                    return match ? match[0] === cNum : false;
                }
            ) || `ch${cNum}`;

            const chapName = structure.nameMap[chapKey] || chapKey;

            if (!map[partKey]) map[partKey] = {};
            if (!map[partKey][chapName]) map[partKey][chapName] = {};
            if (!map[partKey][chapName][s]) map[partKey][chapName][s] = [];
            map[partKey][chapName][s].push(q);
        });

        return map;
    };

    const contentMap = getMappedContent();

    const togglePart = (part: string) => {
        setExpandedParts((prev) => ({ ...prev, [part]: !prev[part] }));
    };

    return (
        <div className="max-w-3xl mx-auto w-full py-8 space-y-6">
            {/* Title */}
            <header>
                <h1 className="text-xl">커리큘럼</h1>
                <p className="text-sm text-foreground/55 mt-1.5">
                    회계감사기준 체계에 따른 단원 구성과 등록된 문제 수입니다.
                </p>
            </header>

            {/* Render hierarchy */}
            <div className="space-y-4">
                {Object.keys(structure.hierarchy).sort().map((partName) => {
                    const isExpanded = expandedParts[partName];
                    const chaps = structure.hierarchy[partName];

                    return (
                        <div key={partName} className="bg-card border border-card-border rounded-lg overflow-hidden">
                            <button
                                onClick={() => togglePart(partName)}
                                aria-expanded={!!isExpanded}
                                className={`w-full px-5 py-3.5 hover:bg-card-border/25 transition-colors flex items-center justify-between text-left cursor-pointer text-sm font-medium text-foreground ${isExpanded ? 'border-b border-card-border' : ''
                                    }`}
                            >
                                <span>{partName}</span>
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-foreground/45" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-foreground/45" />
                                )}
                            </button>

                            {isExpanded && (
                                <div className="p-5 space-y-6 divide-y divide-card-border/40">
                                    {Object.keys(chaps).sort(compareChapters).map((chapKey, idx) => {
                                        const chapName = structure.nameMap[chapKey] || chapKey;
                                        const standards = chaps[chapKey];

                                        return (
                                            <div key={chapKey} className={`${idx > 0 ? 'pt-5' : ''} space-y-3`}>
                                                <h2 className="text-sm font-medium text-foreground">{chapName}</h2>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                    {standards.map((std) => {
                                                        const matchedQs = contentMap[partName]?.[chapName]?.[std] || [];

                                                        return (
                                                            <div key={std} className="space-y-1.5">
                                                                <div className="flex justify-between items-baseline gap-4 pb-1.5 border-b border-card-border">
                                                                    <span className="text-sm text-foreground/80">기준서 {std}</span>
                                                                    <span className="text-xs text-foreground/45 tabular-nums">
                                                                        {matchedQs.length}문항
                                                                    </span>
                                                                </div>

                                                                {matchedQs.length === 0 ? (
                                                                    <p className="text-xs text-foreground/35">등록된 문제 없음</p>
                                                                ) : (
                                                                    matchedQs.map((q) => (
                                                                        <div key={q.id} className="text-xs text-foreground/65 leading-relaxed truncate">
                                                                            {q.question_title}
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
