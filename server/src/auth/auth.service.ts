import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  createHash,
  randomUUID,
  timingSafeEqual,
  webcrypto,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

type BinaryInput = Uint8Array | Buffer | number[] | string | null | undefined;

interface AntlerProofPayload {
  public_key?: BinaryInput;
  timestamp?: bigint | number | string;
  nonce?: BinaryInput;
  context_hash?: BinaryInput;
  signature?: BinaryInput;
}

interface AntlerSessionRegistrationPayload {
  proof?: AntlerProofPayload;
  session_public_key?: BinaryInput;
  presence_proof?: BinaryInput;
  context?: string;
}

interface AntlerSessionRecord {
  sessionId: string;
  expiresAt: number;
  context: string;
  publicKeyHash?: string;
  proofHash?: string;
  userId?: string;
}

@Injectable()
export class AuthService {
  private static readonly ANTLER_CLOCK_SKEW_SECONDS = 60;
  private static readonly ANTLER_SESSION_TTL_SECONDS = 600;

  private readonly usedNonces = new Map<string, number>();
  private readonly antlerSessions = new Map<string, AntlerSessionRecord>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private nowInSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  private pruneExpiredAntlerState() {
    const now = this.nowInSeconds();

    for (const [nonceKey, expiresAt] of this.usedNonces.entries()) {
      if (expiresAt <= now) {
        this.usedNonces.delete(nonceKey);
      }
    }

    for (const [sessionId, session] of this.antlerSessions.entries()) {
      if (session.expiresAt <= now) {
        this.antlerSessions.delete(sessionId);
      }
    }
  }

  private hashBytes(bytes: Uint8Array) {
    return createHash('sha256').update(bytes).digest('hex');
  }

  private decodeStringBytes(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Uint8Array();
    }

    const normalizedBase64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const isHex = /^[\da-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;

    return isHex
      ? Uint8Array.from(Buffer.from(trimmed, 'hex'))
      : Uint8Array.from(Buffer.from(normalizedBase64, 'base64'));
  }

  private toBytes(value: BinaryInput, fieldName: string) {
    if (value instanceof Uint8Array) {
      return value;
    }

    if (Buffer.isBuffer(value)) {
      return Uint8Array.from(value);
    }

    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }

    if (typeof value === 'string') {
      return this.decodeStringBytes(value);
    }

    throw new UnauthorizedException(`Missing or invalid ${fieldName}`);
  }

  private toTimestamp(value: bigint | number | string | undefined) {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      return BigInt(value);
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return BigInt(value.trim());
    }

    throw new UnauthorizedException('Missing or invalid timestamp');
  }

  private writeLengthPrefixed(bytes: Uint8Array) {
    const result = Buffer.alloc(8 + bytes.length);
    result.writeBigUInt64LE(BigInt(bytes.length), 0);
    Buffer.from(bytes).copy(result, 8);
    return result;
  }

  private buildAntlerCandidateMessages(
    publicKey: Uint8Array,
    timestamp: bigint,
    nonce: Uint8Array,
    contextHash: Uint8Array,
  ) {
    const timestampLe = Buffer.alloc(8);
    timestampLe.writeBigUInt64LE(timestamp);

    const timestampBe = Buffer.alloc(8);
    timestampBe.writeBigUInt64BE(timestamp);

    // Accept both the legacy concatenation used in this codebase and the
    // length-prefixed LE encoding used by the installed SDK helpers.
    return [
      Buffer.concat([
        Buffer.from(publicKey),
        timestampLe,
        Buffer.from(nonce),
        Buffer.from(contextHash),
      ]),
      Buffer.concat([
        Buffer.from(publicKey),
        timestampBe,
        Buffer.from(nonce),
        Buffer.from(contextHash),
      ]),
      Buffer.concat([
        this.writeLengthPrefixed(publicKey),
        timestampLe,
        this.writeLengthPrefixed(nonce),
        this.writeLengthPrefixed(contextHash),
      ]),
      Buffer.from(contextHash),
    ];
  }

  private async verifyAntlerSignature(
    publicKey: Uint8Array,
    signature: Uint8Array,
    messages: Uint8Array[],
  ) {
    let cryptoKey: CryptoKey;

    try {
      cryptoKey = await webcrypto.subtle.importKey(
        'raw',
        publicKey,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
    } catch {
      throw new UnauthorizedException('Invalid Antler public key');
    }

    for (const message of messages) {
      const isValid = await webcrypto.subtle.verify(
        'Ed25519',
        cryptoKey,
        signature,
        message,
      );

      if (isValid) {
        return true;
      }
    }

    return false;
  }

  private createAntlerSession(
    context: string,
    metadata: Pick<AntlerSessionRecord, 'publicKeyHash' | 'proofHash'> = {},
  ) {
    this.pruneExpiredAntlerState();

    const expiresAt =
      this.nowInSeconds() + AuthService.ANTLER_SESSION_TTL_SECONDS;
    const sessionId = randomUUID();

    this.antlerSessions.set(sessionId, {
      sessionId,
      expiresAt,
      context,
      ...metadata,
    });

    return {
      session_id: sessionId,
      expires_at: expiresAt,
      message: 'Antler verification successful',
    };
  }

  private async verifyAntlerProof(proof: AntlerProofPayload, context: string) {
    this.pruneExpiredAntlerState();

    if (!proof || typeof proof !== 'object') {
      throw new UnauthorizedException('Missing Antler proof');
    }

    const publicKey = this.toBytes(proof.public_key, 'public_key');
    const timestamp = this.toTimestamp(proof.timestamp);
    const nonce = this.toBytes(proof.nonce, 'nonce');
    const contextHash = this.toBytes(proof.context_hash, 'context_hash');
    const signature = this.toBytes(proof.signature, 'signature');

    const timestampSeconds = Number(timestamp);
    if (!Number.isSafeInteger(timestampSeconds)) {
      throw new UnauthorizedException('Invalid timestamp');
    }

    const now = this.nowInSeconds();
    if (
      Math.abs(now - timestampSeconds) > AuthService.ANTLER_CLOCK_SKEW_SECONDS
    ) {
      throw new UnauthorizedException('Expired proof');
    }

    const nonceKey = this.hashBytes(nonce);
    if ((this.usedNonces.get(nonceKey) ?? 0) > now) {
      throw new UnauthorizedException('Replay detected');
    }

    const expectedHash = createHash('sha256').update(context).digest();
    const providedContextHash = Buffer.from(contextHash);

    if (
      providedContextHash.length !== expectedHash.length ||
      !timingSafeEqual(providedContextHash, expectedHash)
    ) {
      throw new UnauthorizedException('Invalid context');
    }

    const messages = this.buildAntlerCandidateMessages(
      publicKey,
      timestamp,
      nonce,
      contextHash,
    );
    const isValid = await this.verifyAntlerSignature(
      publicKey,
      signature,
      messages,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.usedNonces.set(nonceKey, now + AuthService.ANTLER_CLOCK_SKEW_SECONDS);

    return {
      context,
      publicKeyHash: this.hashBytes(publicKey),
    };
  }

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    return this.generateToken(user);
  }

  async antlerAuth(proof: AntlerProofPayload, context = 'antler_auth') {
    const verifiedProof = await this.verifyAntlerProof(proof, context);

    return this.createAntlerSession(context, {
      publicKeyHash: verifiedProof.publicKeyHash,
    });
  }

  async registerAntlerSession(payload: AntlerSessionRegistrationPayload) {
    const context = payload?.context?.trim() || 'default';

    if (payload?.proof) {
      return this.antlerAuth(payload.proof, context);
    }

    const sessionPublicKey = this.toBytes(
      payload?.session_public_key,
      'session_public_key',
    );
    const presenceProof = this.toBytes(
      payload?.presence_proof,
      'presence_proof',
    );

    if (!sessionPublicKey.length || !presenceProof.length) {
      throw new UnauthorizedException('Invalid Antler session registration');
    }

    return this.createAntlerSession(context, {
      publicKeyHash: this.hashBytes(sessionPublicKey),
      proofHash: this.hashBytes(presenceProof),
    });
  }

  async exchangeAntlerSession(sessionId: string | undefined | null) {
    const session = this.getAntlerSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired Antler session');
    }

    const emailSeed =
      session.publicKeyHash || session.proofHash || session.sessionId;
    const email = `antler+${emailSeed}@vpshub.local`;
    const fallbackName = `Antler ${emailSeed.slice(0, 8)}`;

    let user = session.userId
      ? await this.prisma.user.findUnique({ where: { id: session.userId } })
      : null;

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: fallbackName,
        },
      });
    }

    this.antlerSessions.set(session.sessionId, {
      ...session,
      userId: user.id,
    });

    return {
      ...this.generateToken(user),
      session_id: session.sessionId,
      expires_at: session.expiresAt,
      message: 'Antler access granted',
    };
  }

  getAntlerSession(sessionId: string | undefined | null) {
    this.pruneExpiredAntlerState();

    const normalizedSessionId = sessionId?.trim();
    if (!normalizedSessionId) {
      return null;
    }

    return this.antlerSessions.get(normalizedSessionId) ?? null;
  }

  validateSession(sessionId: string | undefined | null) {
    return this.getAntlerSession(sessionId) !== null;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async validateGoogleUser(googleUser: any) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: `${googleUser.firstName} ${googleUser.lastName}`,
          googleId: googleUser.id,
          avatar: googleUser.picture,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.id, avatar: googleUser.picture },
      });
    }

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }
}
