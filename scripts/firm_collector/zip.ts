import { inflateRawSync } from 'node:zlib';

/**
 * 최소 ZIP 리더.
 *
 * OpenDART 의 corpCode.xml 은 ZIP 으로 내려온다. 이거 하나 때문에 압축 라이브러리를
 * 의존성에 더하고 싶지 않아 직접 읽는다. 중앙 디렉터리(central directory)를 훑기 때문에
 * 로컬 헤더에 크기가 0 으로 오고 data descriptor 로 넘어오는 파일도 안전하게 읽는다.
 * 지원 압축 방식은 0(무압축)과 8(deflate) 뿐이며, 그 외에는 던진다.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export interface ZipEntry {
    fileName: string;
    data: Buffer;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
    // EOCD 는 가변 길이 주석이 뒤에 붙을 수 있어 끝에서부터 찾는다 (주석 최대 65535).
    const minimum = 22;
    const start = Math.max(0, buffer.length - (minimum + 0xffff));
    for (let offset = buffer.length - minimum; offset >= start; offset -= 1) {
        if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
    }
    throw new Error('ZIP 형식이 아닙니다: End of Central Directory 를 찾지 못했습니다.');
}

export function readZipEntries(buffer: Buffer): ZipEntry[] {
    const eocd = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocd + 10);
    let cursor = buffer.readUInt32LE(eocd + 16);

    const entries: ZipEntry[] = [];

    for (let i = 0; i < entryCount; i += 1) {
        if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
            throw new Error(`ZIP 중앙 디렉터리가 손상됐습니다 (항목 ${i}).`);
        }

        const method = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const localOffset = buffer.readUInt32LE(cursor + 42);
        const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

        if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
            throw new Error(`ZIP 로컬 헤더가 손상됐습니다: ${fileName}`);
        }

        // 로컬 헤더의 이름·extra 길이는 중앙 디렉터리 값과 다를 수 있으므로 여기서 다시 읽는다
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const raw = buffer.subarray(dataStart, dataStart + compressedSize);

        if (method === 0) {
            entries.push({ fileName, data: Buffer.from(raw) });
        } else if (method === 8) {
            entries.push({ fileName, data: inflateRawSync(raw) });
        } else {
            throw new Error(`지원하지 않는 ZIP 압축 방식 ${method} 입니다: ${fileName}`);
        }

        cursor += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}
