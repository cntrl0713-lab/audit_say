import crypto from 'node:crypto';

interface EncryptedQuestionBankV3 {
    format: 'audit-say-v3-authoring';
    version: 1;
    algorithm: 'aes-256-gcm';
    iv: string;
    auth_tag: string;
    ciphertext: string;
}

const KEY_CONTEXT = 'audit-say:v3-authoring:v1\0';

function deriveKey(secret: string): Buffer {
    if (!secret) throw new Error('v3 문제은행 복호화 키가 설정되지 않았습니다.');
    return crypto.createHash('sha256')
        .update(KEY_CONTEXT, 'utf8')
        .update(secret, 'utf8')
        .digest();
}

export function encryptAuthoringQuestionBankV3(plaintext: string, secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const envelope: EncryptedQuestionBankV3 = {
        format: 'audit-say-v3-authoring',
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        auth_tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    };
    return `${JSON.stringify(envelope)}\n`;
}

export function decryptAuthoringQuestionBankV3(encrypted: string, secret: string): string {
    let envelope: EncryptedQuestionBankV3;
    try {
        envelope = JSON.parse(encrypted) as EncryptedQuestionBankV3;
    } catch {
        throw new Error('암호화된 v3 문제은행의 JSON 형식이 올바르지 않습니다.');
    }
    if (
        envelope.format !== 'audit-say-v3-authoring'
        || envelope.version !== 1
        || envelope.algorithm !== 'aes-256-gcm'
        || typeof envelope.iv !== 'string'
        || typeof envelope.auth_tag !== 'string'
        || typeof envelope.ciphertext !== 'string'
    ) {
        throw new Error('암호화된 v3 문제은행의 형식 또는 버전을 지원하지 않습니다.');
    }

    try {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            deriveKey(secret),
            Buffer.from(envelope.iv, 'base64'),
        );
        decipher.setAuthTag(Buffer.from(envelope.auth_tag, 'base64'));
        return Buffer.concat([
            decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        throw new Error('v3 문제은행 복호화에 실패했습니다. 배포 환경의 암호화 키를 확인하세요.');
    }
}
