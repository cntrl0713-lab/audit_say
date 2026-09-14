// 관찰 O5: 전수 검증 범위 78물음 중 coverage 관계가 없는 49물음을 question-elements의 기출·모의·연습 요소와 대조한다.
// 원발문과 기준서 원문을 담당 agent가 대조해 대응 관계가 성립한 요소만 reviewed 관계로 추가하고, 연결하지 않은 물음의 후보·기각 이유를 함께 남긴다.
// 관계 장부(links.json)만 쓴다. 정본·모델 호출 없음.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/o5-coverage.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash,sourceUnitHash,elementFile} from '../../../coverage/build-coverage.mjs';
import {buildSourceCatalog} from '../../../../questionSourceCatalog.mjs';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v4';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/o5-relationship-review.json'),'O5 관계 검토가 이미 있다');
const installed=read(F+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');
for(const r of installed.files)assert.equal(ref(r.file).sha256,r.sha256,'설치 후 정본이 바뀌었다: '+r.file);
const LINKS='cpa_uploader/analysis/coverage/links.json',bytes=fs.readFileSync(LINKS,'utf8'),ledger=JSON.parse(bytes);
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),dataset=read(elementFile),scope=read(V+'/scope.json');
const P='std-points-20260914-',D='draft-standard-';
// 원문 단위: 공식 전사본을 우선하고, 없으면 통합학습자료 단위를 쓴다(학습자료 단위를 공식성 확인으로 승격하지 않는다).
const U={
 k500A65:'src-0b806009fd31a1c97e',k330p22:'src-2baf3ec238b61cb2b9',k320A4:'src-6dc672308bbc248586',k580p3:'src-abea434041c483bcfe',k580p4:'src-004b32a323fbf7ccf3',k580p9:'src-3273ca3918a63aa6bc',
 eth2203:'src-0259bfb0f5e6ca1b99',eth2302:'src-87ce83f37b55c0d8c2',eth2403:'src-751ce37b610dc6735b',k1100p23:'src-c78cb2f90deec22d16',k1100A25:'src-d672115817c8c1866e',
 k230p13:'src-50d34ba0ef597f029f',k300p8:'src-037939daa9244c6983',k240p30:'src-68550ed31bea3f493a',k265p6:'src-eab916045ec62924a2',k315p21:'src-4ebb4b4c2f9b123b11',
 law22:'src-a4e17f4e10612027bc',k510p5:'src-27a2c85b772dc27a2d',k510p6:'src-3fd272656187554df5',k530ap4:'src-8ea353a068875f3cf6',k530A13:'src-30e0f8d32be9d76001',k706A1:'src-a68af7147e810c06be'};
// [대상 물음, 요소, 관계, criterion, 원문 단위, 판단 이유]
const L=[
 [P+'0ba89f2456ad/sub2','element-8ee13517bf9b9cc8','direct',['crit1','crit1.sp2','crit2','crit3'],[U.k500A65],'연습(필수암기 기본 141)은 500.A65의 추출될 특정 항목 예시 세 가지를 요구한다. 물음도 같은 세 범주(금액이 크거나 주요한 항목, 일정 금액 초과 항목, 정보 입수 목적 항목)와 주요 항목의 성격을 묻는 같은 요구다.'],
 [P+'0ba89f2456ad/sub2','element-d388567517406683','broader',['crit1','crit2','crit3'],[U.k500A65],'2014년 기출 4-1은 전수조사와 특정항목 추출이 적합한 경우를 각각 두 개씩 요구한다. 물음은 특정항목 추출 범주 세 가지 전부와 주요 항목의 예까지 요구하므로 상위 요구다. 같은 기출의 전수조사 부분은 draft-standard-gap-20260913-g02/sub1이 다룬다.'],
 [P+'8f1e15100ee9/sub1','element-958ade1a0fc89a0d','direct',['crit1','crit2'],[U.k330p22],'연습(필수암기 기본 96)은 기중 일자 기준 실증절차의 결론을 보고기간말까지 확대하기 위한 잔여기간 절차(330.22)를 묻는다. 물음과 같은 두 경로(통제테스트를 수반한 실증절차, 충분하다고 결정한 경우의 후속 실증절차)를 요구한다.'],
 [D+'gap-20260913-g08/sub1','element-a933c27cc5032544','broader',['crit2','crit3','crit4','crit5','crit6','crit7','crit8'],[U.k320A4],'연습(필수암기 기본 38)은 벤치마크 식별에 영향을 미치는 요인 중 재무제표 요소를 제외한 세 가지를 요구한다. 물음은 320.A4의 요인 전부와 기업 요인의 구체 내용을 요구하므로 상위 요구다.'],
 [D+'gap-20260913-g08/sub1','element-e643a8eaa3c250d2','partial',['crit6','crit7'],[U.k320A4],'2025 모의 2회 4-2는 부채로만 자금을 조달하는 기업에서 벤치마크 식별에 가장 관련 높은 요인 하나와 적합한 벤치마크·이유를 요구한다. 물음은 요인(소유구조·자본조달방법)만 다루고 벤치마크 선택과 이유는 다루지 않는다.'],
 [P+'1cae16e579d0/sub1','element-af562295b960a0d0','broader',['crit2'],[U.k580p4],'2024 모의 1회 2-3의 "일부 서면진술은 단독으로 충분한 증거" 진술은 580.4의 "서면진술 그 자체는 충분하고 적합한 감사증거를 제공하지 않는다"로 판정한다. 물음은 이 명제와 감사증거 해당 여부, 다른 감사증거에 대한 영향까지 요구하므로 상위 요구다.'],
 [P+'1cae16e579d0/sub1','element-85fa1b66060d131d','broader',['crit2'],[U.k580p4],'같은 2024 모의 진술이 부적절한 이유(580.4)를 묻는 요소다. 물음 crit2가 그 이유 명제이며 물음은 다른 두 명제도 요구한다.'],
 [P+'1cae16e579d0/sub1','element-b46bd79bd0f0325a','partial',['crit1'],[U.k580p3],'2025 모의 2회 4-3 ③의 "질문에 대한 답변과 마찬가지로 서면진술은 감사증거이자 감사증거의 중요한 원천" 진술 중 감사증거 해당 여부는 580.3과 물음 crit1에 대응한다. "중요한 원천" 부분은 물음이 다루지 않는다.'],
 [D+'gap-20260913-g09/sub2','element-cf80954142533959','direct',['crit1','crit2'],[U.k580p9],'연습(필수암기 기본 154)은 어떠한 경영진으로부터 서면진술을 입수해야 하는지 묻는다. 580.9의 두 요건(재무제표에 대한 적절한 책임, 관심 사항에 대한 지식)을 요구하는 물음과 같다.'],
 [D+'gap-20260913-g09/sub2','element-530587c5bdde4583','partial',['crit1','crit2'],[U.k580p9],'2016년 기출 8-5는 회계기간 중 경영진이 교체된 경우 서면진술 요청 대상자·대상기간·이유를 요구한다. 물음은 요청 대상자 요건(580.9)만 다루고 교체 상황의 대상기간·이유는 다루지 않는다.'],
 [D+'gap-20260913-g09/sub2','element-1b06b031d24bf134','partial',['crit1','crit2'],[U.k580p9],'같은 경영진 교체 사례를 쓴 연습 요소로 서면진술 요청 대상자를 묻는다. 물음은 대상자 요건의 일반 원칙만 다루고 교체 상황의 적용은 다루지 않는다.'],
 [D+'expansion-20260913-e01/sub1','element-083c6ccc32a9e294','direct',['crit1','crit2','crit3','crit4','crit5','crit6'],[U.eth2203],'연습(필수암기 기본 17)의 (1) 이해상충 상황의 기본적인 안전장치는 윤리기준 220.3의 통보·동의다. 물음은 세 경우별 통보 내용·상대방과 동의를 모두 요구하여 같은 범위다. (2) 추가적 안전장치는 이 물음의 범위가 아니다.'],
 [D+'expansion-20260913-e01/sub1','element-1dba5624e53a3987','broader',['crit3','crit4'],[U.eth2203],'2018년 기출 1-2의 필수적(기본적) 안전장치는 동일 주식의 매도자·매수자 양측 자문 사례에서 모든 이해관계자 통보와 동의다. 물음은 220.3의 세 경우 전부를 요구하므로 상위 요구다.'],
 [D+'expansion-20260913-e01/sub4','element-5b416121237d784c','broader',['crit1','crit2','crit3'],[U.eth2302],'연습(필수암기 기본 18)은 제2의견 요청을 받은 회계법인이 마련할 안전장치를 요구하며 230.2의 세 안전장치에 대응한다. 물음은 230.3의 의견교환 불허 시 고려까지 요구하므로 상위 요구다.'],
 [D+'expansion-20260913-e01/sub4','element-21656e61c82bcc96','broader',['crit1','crit2','crit3'],[U.eth2302],'빈출정리 사례(유리한 정보만 제공할 가능성이 있는 제2의견 요청)의 제2의견 제공 시 안전장치 요구로 230.2의 세 안전장치에 대응한다. 물음은 230.3까지 요구한다.'],
 [D+'expansion-20260913-e01/sub4','element-679784cd73c1525f','partial',['crit1','crit2','crit3'],[U.eth2302],'2021년 기출 1-2 상황은 유리한 정보만 제공할 가능성이 높은 제2의견 요청에서 관련 윤리강령과 안전장치를 요구한다. 물음은 안전장치만 다루고 윤리강령 식별은 다루지 않는다.'],
 [P+'68b9bac9fd95/sub1','element-d48af0424034110d','broader',['crit8'],[U.k1100p23,U.k1100A25],'연습 판단 문항의 "하향식 접근법의 사고 순서와 감사절차 수행 순서 구분"은 물음 crit8(순차적 사고과정이며 실제 감사절차를 그 순서로 수행해야 한다는 뜻은 아님)과 같다. 물음은 선정 기준과 검증 내용까지 요구하여 상위 요구다.'],
 [P+'68b9bac9fd95/sub1','element-0080a7c6b1b751e7','broader',['crit8'],[U.k1100p23,U.k1100A25],'2025 모의 2회 6-2 감사계획 중 하향식 접근법과 실제 절차 수행순서를 다르게 한 항목의 적절성 판단은 물음 crit8의 원칙으로 판정한다. 물음은 선정 기준과 검증 내용까지 요구한다.'],
 [P+'68b9bac9fd95/sub1','element-0e6f86b90f8ae420','broader',['crit8'],[U.k1100p23,U.k1100A25],'같은 2025 모의 항목이 부적절한 경우 그 이유를 묻는 요소로 물음 crit8의 원칙에 대응한다. 물음은 선정 기준과 검증 내용까지 요구한다.'],
 [P+'d22c23444c4b/sub1','element-b9be4e2c45a8040c','partial',['crit1','crit2','crit3','crit4','crit5'],[U.k230p13],'연습은 감사보고서일 후 새로운·추가 감사절차나 새 결론 시 문서화할 사항(230.13 전체)을 요구한다. 물음은 13(a)~(b)만 요구하고 13(c)는 std-points-20260914-6e9dfa933285/sub1이 다룬다.'],
 [P+'d22c23444c4b/sub1','element-d7588078175c7aca','partial',['crit1','crit2','crit3','crit4','crit5'],[U.k230p13],'2024 모의 2회 5-7은 감사보고서일 후 알게 된 소송 판결에 대한 후속절차 결과 감사문서에 추가할 사항 세 가지를 요구한다(230.13). 물음은 13(a)~(b)에 대응하고 13(c)는 다른 물음이 다룬다.'],
 [P+'6e9dfa933285/sub1','element-b9be4e2c45a8040c','partial',['crit6','crit6.sp2','crit7','crit7.sp2'],[U.k230p13],'연습은 230.13 전체의 문서화 사항을 요구한다. 물음은 13(c)의 변경·검토 사람과 시기만 요구하고 13(a)~(b)는 std-points-20260914-d22c23444c4b/sub1이 다룬다.'],
 [P+'6e9dfa933285/sub1','element-d7588078175c7aca','partial',['crit6','crit6.sp2','crit7','crit7.sp2'],[U.k230p13],'2024 모의 2회 5-7의 감사문서 추가 사항 중 13(c)의 변경자·변경 시기·검토자·검토 시기에 대응한다.'],
 [D+'expansion-20260913-s02/sub1','element-49b6e4c40095d806','broader',['crit2','crit3','crit4'],[U.k300p8],'연습 빈칸 문항은 300.8의 보고목적·요구되는 커뮤니케이션의 성격·전문가적 판단·유의적 요소 등의 표현을 채우게 한다. 물음은 300.8(a)~(d)의 절차 전체를 서술하게 하므로 상위 요구다.'],
 [D+'expansion-20260913-s03/sub1','element-ba1946f903a85e2a','direct',['crit1','crit2','crit3','crit4'],[U.k240p30],'연습(필수암기 기본 111)은 재무제표 수준 부정위험에 대한 전반적 대응을 결정할 때 수행할 절차(240.30)를 묻는다. 물음과 같은 요구다.'],
 [D+'expansion-20260913-s03/sub1','element-eb9d42eb40a888f2','broader',['crit1','crit2','crit3','crit4'],[U.k240p30],'연습 사례는 허위 다중회선계약으로 재무제표 수준 부정위험이 매우 높을 때 전반적 대응 절차 세 가지를 요구한다. 물음은 240.30 전부를 사례 없이 요구하여 상위 요구다.'],
 [D+'expansion-20260913-s03/sub1','element-65e48bd4d004b102','partial',['crit1','crit2','crit3','crit4'],[U.k240p30],'2025 모의 1회 5-2의 "재무제표 수준 부정위험에 개별 추가감사절차의 성격·시기·범위로만 대응" 진술은 240.30의 전반적 대응이 필요하다는 점으로 판정한다. 물음은 전반적 대응 절차를 다루지만 진술의 적절성 판단 자체는 묻지 않는다.'],
 [D+'expansion-20260913-s05/sub1','element-f2e6d6c7b2064775','broader',['crit1','crit2'],[U.k265p6],'연습은 내부통제 미비점과 유의적 내부통제 미비점의 정의를 요구한다. 이 요소(미비점 정의)는 물음 crit1·crit2와 같고 물음은 유의적 미비점 정의까지 요구한다.'],
 [D+'expansion-20260913-s05/sub1','element-09e40c78cce748c6','broader',['crit3'],[U.k265p6],'같은 연습의 유의적 내부통제 미비점 정의 요소로 물음 crit3와 같다. 물음은 미비점이 존재하는 두 경우까지 요구한다.'],
 [D+'expansion-20260913-s06/sub2','element-221a294bd6a481cc','direct',['crit1','crit2','crit3'],[U.k315p21],'연습(필수암기 기본 74)은 통제환경의 이해를 위한 감사인의 평가사항 세 가지(315.21(b))를 요구한다. 물음과 같은 요구다.'],
 [P+'4c199da69f8f/sub1','element-a9e4df9a840d93c0','broader',['crit1'],[U.eth2403],'연습 표의 "의뢰인에게 비인증업무에 대한 성공보수를 지급받기로 하는 경우"의 위협 종류(이기적 위협)는 윤리기준 240.3과 물음 crit1에 대응한다. 물음은 위협받는 강령(공정)까지 요구한다.'],
 [P+'2089042a4b32/sub3','element-5bd625c342ac804a','broader',['crit1'],[U.law22],'2019년 기출 3-4는 감사위원회가 이사의 부정행위나 중대한 정관 위반을 발견한 경우 외부감사법상 후속조치(제22조제6항 감사인 통보)를 요구한다. 물음은 제7항 감사인의 증권선물위원회 보고까지 요구하여 상위 요구다.'],
 [P+'2089042a4b32/sub3','element-6d60e76133e8f3a3','partial',['crit2','crit3'],[U.law22],'2018년 기출 1-4 ①은 대표이사의 횡령(법령·정관의 중대한 위반)을 발견한 감사인의 외부감사법상 조치를 요구한다(제22조제1항 통보·보고, 제7항 증권선물위원회 보고). 물음은 제7항의 대상사실과 감사인 발견 시 보고만 다루고 제1항은 draft-standard-followup-20260913-l01/sub1이 다룬다.'],
 [D+'followup-20260913-l01/sub1','element-6d60e76133e8f3a3','partial',['crit1','crit2'],[U.law22],'같은 2018년 기출 1-4 ①의 외부감사법상 조치 중 제22조제1항의 감사·감사위원회 통보와 주주총회 보고에 대응한다. 제7항 증권선물위원회 보고는 std-points-20260914-2089042a4b32/sub3이 다룬다.'],
 [D+'followup-20260913-l01/sub1','element-7a68ff96a325edcd','partial',['crit1','crit2'],[U.law22],'2022년 기출 6-3은 부문 횡령에 지배회사 이사가 연루된 경우 회사 내 의사소통 상대·유형·근거(회계감사기준·외부감사법)를 모두 요구한다. 물음은 외부감사법 제22조제1항의 감사·감사위원회 통보와 주주총회 보고에 대응하고 회계감사기준에 따른 지배기구 커뮤니케이션은 다루지 않는다.'],
 [D+'followup-20260913-l01/sub1','element-712435812cd14766','partial',['crit1','crit2'],[U.law22],'같은 사례를 쓴 연습 요소로 회사 내 의사소통 상대 식별을 요구한다. 물음은 외부감사법 제22조제1항의 상대(감사·감사위원회, 주주총회)에 대응한다.'],
 [D+'followup-20260913-l01/sub1','element-93cd18e430641c33','partial',['crit1','crit2'],[U.law22],'같은 연습의 상대별 의사소통 유형(통보·보고) 요소다. 물음의 감사·감사위원회 통보와 주주총회 보고 구분에 대응하며 회계감사기준의 커뮤니케이션은 다루지 않는다.'],
 [D+'followup-20260913-l01/sub1','element-09e0a74b53759ef7','partial',['crit1','crit2'],[U.law22],'같은 연습의 의사소통 근거 요소다. 물음은 외부감사법 제22조제1항 근거 부분에 대응하고 회계감사기준 근거는 다루지 않는다.'],
 [D+'followup-20260913-s02/sub1','element-d5112ab0ab300588','partial',['crit1','crit2','crit3','crit4'],[U.k510p5,U.k510p6],'연습(필수암기 기본 98)은 510.5의 열람을 전제로 기초잔액 왜곡표시에 관한 증거 입수 절차(510.6)를 요구한다. 물음은 510.5와 6(a)·(b)만 다루고 6(c)의 증거 입수 경로는 제외한다.'],
 [D+'followup-20260913-s02/sub1','element-9e5d32594f60d08f','partial',['crit3','crit4'],[U.k510p6],'2023 모의 3회 5-5는 초도감사 기초잔액 왜곡표시 확인을 위한 절차 두 가지(예시 제외)를 요구한다(510.6). 물음은 6(a)·(b)에 대응하고 6(c)는 다루지 않는다.'],
 [D+'followup-20260913-s02/sub1','element-21530d6ca8c1caa3','partial',['crit3','crit4'],[U.k510p6],'연습 사례는 기초잔액과 관련해 감사인이 수행할 절차 세 가지를 요구한다(510.6). 물음은 6(a)·(b)에 대응하고 6(c)는 다루지 않는다.'],
 [P+'22ef6986d79c/sub2','element-c3b9c4824311d3b1','broader',['crit4'],[U.k530ap4,U.k530A13],'2017년 기출 4-3은 체계적 추출법을 사용할 수 있는 모집단의 상황을 요구한다. 물음 crit4(모집단 배열이 추출간격과 상응하는 특정 유형이 아닌지 확인)와 같고 물음은 간격·출발점·무작위성까지 요구한다.'],
 [P+'22ef6986d79c/sub2','element-f621154fe58307b8','broader',['crit4'],[U.k530ap4,U.k530A13],'같은 기출을 수록한 연습 요소(모집단 배열 조건)로 물음 crit4와 같다. 물음은 간격·출발점·무작위성까지 요구한다.'],
 [P+'22ef6986d79c/sub2','element-17554e211d7a6e71','partial',['crit1'],[U.k530ap4,U.k530A13],'2015년 기출 7-1 (4)는 속성표본감사에서 매출액을 표본크기로 나누어 추출간격을 산정한 절차의 오류를 지적하게 한다. 물음 crit1(표본단위 수를 표본규모로 나누어 간격 산정)과 관련되며 기출은 사례의 오류 지적과 이유를 요구한다.'],
 [D+'followup-20260913-s05/sub1','element-aade7dabcecaba1b','broader',['crit1'],[U.k706A1],'연습 사례는 핵심감사사항 일부를 강조사항문단으로 보고하는 방안을 묻는다(706.A1: 강조사항문단은 핵심감사사항의 기술을 대체하지 않는다). 물음은 대체할 수 없는 네 사항 전부를 요구한다.'],
];
// 연결하지 않은 물음: 검색한 표현과 가장 가까운 후보, 기각 이유
const ASSERT='경영진주장 범주의 명칭·정의 자체를 요구하는 요소가 없다. 가까운 후보는 절차별 관련 주장 식별(예: element-1458e46e8d932dea 금융기관 조회로 확인할 경영진주장, element-1fbb03fd9d324806 실재성·발생사실에 적합한 입수방법)처럼 사례에 적용하는 인접 요구다. element-df31ccd89c6a5c78은 관련경영진주장의 정의로 다른 요구다.';
const NOLINK={
 [P+'44a4823e71a6/sub1']:ASSERT,[P+'0f1600bf31cf/sub1']:ASSERT,[P+'f3a365184a5c/sub1']:ASSERT,[P+'6ca8aa8dcc2a/sub1']:ASSERT,[P+'74ee4919bc3f/sub2']:ASSERT,[P+'b1669eebcd57/sub2']:ASSERT,[P+'1d76603a5832/sub2']:ASSERT,[P+'79485430d317/sub2']:ASSERT,
 [P+'c3d6fde34fc2/sub1']:'element-edc1f6b71281768e(2023년 기출 5-3, 전기 통제테스트 결과의 재사용 가능 여부)는 330.14의 조건 판단으로 330.13의 고려사항과 다른 요구다. 이 요소는 이미 pilot-07-006에 연결되어 있다.',
 [P+'5571d08338aa/sub1']:'element-edc1f6b71281768e(2023년 기출 5-3)는 330.14의 조건 판단으로 330.13의 고려사항과 다른 요구다.',
 [P+'f70c845ada83/sub1']:'"예상하지 못한 왜곡표시", "위험평가 수정" 등으로 찾았으나 330.23을 묻는 요소가 없다.',
 [P+'77c18d11552f/sub1']:'element-b7ded54b2e81e712(하향식 접근법 사용 의무 진술 판단)는 사용 의무를 묻는 인접 요구이고 상위 흐름을 묻지 않는다.',
 [D+'expansion-20260913-e01/sub3']:'"사임", "수임하지", "동의 거절", "업무수행 포기" 등으로 찾았으나 이해상충 해소 불가·동의 거절 시 조치를 묻는 요소가 없다.',
 [P+'1cbf1e117847/sub1']:'315.21(a)의 통제·절차·구조를 묻는 요소가 없다. element-221a294bd6a481cc는 21(b)의 평가사항으로 draft-standard-expansion-20260913-s06/sub2에 연결했다.',
 [P+'4906e3107ecd/sub1']:'315.21(a)(iv)·(v)를 묻는 요소가 없다. element-221a294bd6a481cc는 21(b)의 평가사항이다.',
 [P+'ae160de36d94/sub1']:'"서면진술"과 "불일치·일관되지 않" 등으로 찾았으나 580.17을 묻는 요소가 없다.',
 [P+'e7a3730d6484/sub1']:'"서면진술"과 "불일치·신뢰성" 등으로 찾았으나 580.17을 묻는 요소가 없다.',
 [P+'f47d4eaf7a09/sub1']:'양방향 커뮤니케이션 요소는 효익(260.4)만 있다(governance.communication-benefits 등). 부적절한 커뮤니케이션의 영향 평가(260.22)는 없다.',
 [P+'7e1091f2c13f/sub1']:'양방향 커뮤니케이션 요소는 효익(260.4)만 있고 해결불능 시 대응조치(260.A53)는 없다.',
 [D+'expansion-20260913-s05/sub2']:'"왜곡표시를 발견하지" + "미비점"으로 찾았으나 265.A5를 묻는 요소가 없다.',
 [P+'b536c2e2b3ec/sub1']:'성공보수 요소는 위협 종류·안전장치·수임 가능 여부이며 위협의 중요성 결정요인(240.3)을 묻는 요소가 없다.',
 [P+'d1153a74ea69/sub1']:'비밀유지 요소(element-d39b31f43ec55de2, element-97dcc7b9d6c871b2)는 기밀정보를 공개할 수 있는 예외(140.7)를 묻는 인접 요구이고 공개 여부 결정 시 고려사항(140.8)은 없다.',
 [P+'f2b5ccde7895/sub2']:'외부감사법 제22조제3항·제4항(조사·시정요구·결과제출)을 묻는 요소가 없다.',
 [P+'733bd911cb7c/sub2']:'외부감사법 제22조제5항(대표자에 대한 자료·비용 지원 요청)을 묻는 요소가 없다.',
 [P+'a95fb9474769/sub1']:'손해배상 요소는 책임사유·면책사유·소멸시효·입증책임·보장제도이며 외부감사법 제31조의 연대책임을 묻는 요소가 없다.',
 [P+'874ec474222d/sub1']:'범위제한 요소는 전반성 판단과 의견 영향(705.8·13 등)이며 수임 후 제한 제거 요청과 후속 조치(705.11~12)는 없다.',
 [P+'c9c523cdf8c0/sub2']:'2018년 기출 7-3의 커뮤니케이션 시기 요소(element-46f765c4b70d766d)는 적시성(260.21) 판단이며 커뮤니케이션 절차의 사전 커뮤니케이션(260.18)과 다른 요구다.',
 [P+'3e3ab8d53e62/sub2']:'2018년 기출 7-3의 구두·서면 방식 요소(element-b1e3165b217ad2dc)는 서면 커뮤니케이션 요구(260.19)의 판단이며 구두 커뮤니케이션의 문서화(260.23)와 다른 요구다.',
 [D+'followup-20260913-s04/sub1']:'"보충적 정보", "재무보고체계에서 요구하지 않는" 등으로 찾았으나 700.53~54를 묻는 요소가 없다.',
};
// 1. 대상 범위 확인: 49물음 = 연결 20물음 + 미연결 29물음
const unlinkedBefore=scope.targets.map(t=>t.set_id+'/'+t.subquestion_id).filter(k=>!ledger.links.some(l=>l.target&&l.target.set_id+'/'+l.target.subquestion_id===k));
assert.equal(unlinkedBefore.length,49);
const linkedTargets=[...new Set(L.map(x=>x[0]))];
assert.deepEqual([...linkedTargets,...Object.keys(NOLINK)].sort(),[...unlinkedBefore].sort(),'O5 판정 범위가 미연결 49물음과 다르다');
// 2. 관계 생성
const catalog=buildSourceCatalog({repoDir:process.cwd()}),units=new Map(catalog.units.map(u=>[u.id,u])),elements=new Map(dataset.elements.map(e=>[e.id,e]));
const reviewRows=[],links=[];
L.forEach(([target,elementId,relationship,criteria,unitIds,reason],i)=>{
 const [setId,subId]=target.split('/'),set=bank.find(s=>s.id===setId),sub=set.subquestions.find(q=>q.id===subId),element=elements.get(elementId);
 assert(element,'요소 없음: '+elementId);assert.equal(element.catalog_status,'extracted');assert(['direct','partial','broader'].includes(relationship));
 for(const c of criteria)assert(sub.criteria.some(k=>k.id===c),'criterion 없음: '+target+' '+c);
 for(const u of unitIds)assert(units.get(u),'원문 단위 없음: '+u);
 assert(!ledger.links.some(l=>l.element_id===elementId&&l.target&&l.target.set_id===setId&&l.target.subquestion_id===subId),'이미 같은 관계가 있다: '+elementId+' '+target);
 const id=`standard-new-verification-20260914-o5-${String(i+1).padStart(2,'0')}`;assert(!ledger.links.some(l=>l.id===id));
 links.push({id,element_id:elementId,source_unit_ids:unitIds,target:{set_id:setId,subquestion_id:subId,criterion_ids:criteria},relationship,review_status:'reviewed',reason,
  snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(set,sub),source_hashes:Object.fromEntries(unitIds.map(u=>[u,units.get(u).contentHash])),source_metadata_hashes:Object.fromEntries(unitIds.map(u=>[u,sourceUnitHash(units.get(u))]))}});
 reviewRows.push({link_id:id,target,element_id:elementId,element_label:element.label,exam_frequency:element.exam_frequency,mock_frequency:element.mock_frequency,relationship,criterion_ids:criteria,source_unit_ids:unitIds,source_units:unitIds.map(u=>({id:u,standard:units.get(u).standard??null,paragraph:units.get(u).paragraph??null,kind:units.get(u).kind,authority:units.get(u).authority,file:units.get(u).file})),reason});
});
assert.equal(links.length,45);
const review=write(F+'/o5-relationship-review.json',{version:1,created_at:new Date().toISOString(),observation:'O5',authorization:ref(F+'/authorization.md'),scope:{questions:49,linked_questions:linkedTargets.length,unlinked_questions:Object.keys(NOLINK).length,new_links:links.length},method:'미연결 49물음마다 발문·모범답안의 핵심 표현으로 question-elements의 요소 라벨·별칭과 원발문(records.text)을 찾고, 후보 요소의 실제 발문과 기준서·학습자료 원문 단위를 대조했다. 같은 요구(direct), 요소의 일부만 다루는 경우(partial), 물음이 요소보다 넓은 경우(broader)만 연결했다. 사례 적용이나 다른 문단을 묻는 인접 요소는 연결하지 않고 아래 이유를 남겼다.',reviewer:'Claude Code 담당 agent',reviewer_kind:'agent_semantic_relationship_review',human_review_performed:false,model_api_calls:0,linked:reviewRows,not_linked:Object.entries(NOLINK).map(([target,reason])=>({target,reason})),limitations:'관계에 대한 agent 의미 대조이며 사람 확인·실제 채점·시험 적용 판본 확정이 아니다. 학습자료 원문 단위를 공식성 확인으로 승격하지 않는다. 미연결은 미출제 확정이 아니다.'});
for(const l of links){l.provenance={file:review.file,sha256:review.sha256,reviewer_kind:'agent_content_review',review_date:'2026-09-14',observation:'O5'};
 l.review_history=[{reviewed_at:'2026-09-14',reviewer:'Claude Code 담당 agent',kind:'agent_semantic_relationship_review',method:'요소의 원발문과 대상 물음의 발문·criterion·원문 단위를 수동 대조했다. 재수록은 새 출제로 세지 않는다.',decision:l.reason,input:review}];}
// 3. 관계 장부 기록(동시 변경 확인)
assert.equal(fs.readFileSync(LINKS,'utf8'),bytes,'동시 관계 장부 변경');
fs.writeFileSync(F+'/o5-coverage-before.json',JSON.stringify({file:LINKS,sha256:sha(bytes),links:ledger.links.length},null,2)+'\n',{flag:'wx'});
ledger.links.push(...links);
fs.writeFileSync(LINKS,JSON.stringify(ledger,null,2)+'\n');
write(F+'/o5-coverage-update.json',{review,added_links:links.map(l=>l.id),added:links.length,questions_newly_linked:linkedTargets.length,questions_still_unlinked:Object.keys(NOLINK).length,relationships:Object.fromEntries(['direct','partial','broader'].map(r=>[r,links.filter(l=>l.relationship===r).length])),input_hash:sha(bytes),output_hash:sha(fs.readFileSync(LINKS)),existing_links_changed:0});
console.log(JSON.stringify({added:links.length,linked_questions:linkedTargets.length,still_unlinked:Object.keys(NOLINK).length,relationships:Object.fromEntries(['direct','partial','broader'].map(r=>[r,links.filter(l=>l.relationship===r).length]))}));
