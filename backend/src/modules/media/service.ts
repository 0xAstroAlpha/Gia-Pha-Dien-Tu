import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/error-handler';
import type { UploadMediaDto } from './dto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// S3 Client
const s3 = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
    },
    forcePathStyle: true, // Required for MinIO
});

export class MediaService {
    // === Upload file ===
    async upload(
        file: Express.Multer.File,
        metadata: UploadMediaDto,
        uploaderId: string,
    ) {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
            throw new AppError(415, 'UNSUPPORTED_TYPE', 'Chỉ hỗ trợ file JPG, PNG, PDF');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new AppError(413, 'FILE_TOO_LARGE', 'File tối đa 10MB');
        }

        // Generate unique S3 key
        const ext = path.extname(file.originalname);
        const fileKey = `media/${new Date().getFullYear()}/${randomUUID()}${ext}`;

        // Upload to S3
        await s3.send(
            new PutObjectCommand({
                Bucket: config.s3.bucket,
                Key: fileKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );

        // Create DB record
        const media = await prisma.media.create({
            data: {
                fileKey,
                fileName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
                title: metadata.title,
                description: metadata.description,
                date: metadata.date ? new Date(metadata.date) : null,
                linkedPersonId: metadata.linkedPersonId,
                linkedEventType: metadata.linkedEventType,
                uploaderId,
                state: 'PENDING',
            },
        });

        return media;
    }

    // === List media ===
    async list(filters: { state?: string; linkedPersonId?: string }, page: number, limit: number) {
        const where: any = {};
        if (filters.state) where.state = filters.state;
        if (filters.linkedPersonId) where.linkedPersonId = filters.linkedPersonId;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma.media.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { uploader: { select: { id: true, displayName: true } } },
            }),
            prisma.media.count({ where }),
        ]);

        return { items, total };
    }

    // === Get single media with signed URL ===
    async getById(id: string) {
        const media = await prisma.media.findUnique({
            where: { id },
            include: { uploader: { select: { id: true, displayName: true } } },
        });

        if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Không tìm thấy media');

        // Generate signed URL
        const signedUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: config.s3.bucket, Key: media.fileKey }),
            { expiresIn: 3600 }, // 1 hour
        );

        return { ...media, signedUrl };
    }

    // === Approve media ===
    async approve(id: string, reviewerId: string) {
        const media = await prisma.media.findUnique({ where: { id } });
        if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Không tìm thấy media');
        if (media.state !== 'PENDING') throw new AppError(400, 'INVALID_STATE', 'Media không ở trạng thái chờ duyệt');

        return prisma.media.update({
            where: { id },
            data: { state: 'PUBLISHED', reviewedBy: reviewerId, reviewedAt: new Date() },
        });
    }

    // === Reject media ===
    async reject(id: string, reviewerId: string) {
        const media = await prisma.media.findUnique({ where: { id } });
        if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Không tìm thấy media');
        if (media.state !== 'PENDING') throw new AppError(400, 'INVALID_STATE', 'Media không ở trạng thái chờ duyệt');

        return prisma.media.update({
            where: { id },
            data: { state: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date() },
        });
    }

    // === Delete media (Admin) ===
    async delete(id: string) {
        const media = await prisma.media.findUnique({ where: { id } });
        if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Không tìm thấy media');

        await prisma.media.delete({ where: { id } });
        // Note: S3 cleanup could be async/background job
        return { message: 'Đã xóa media' };
    }
}

export const mediaService = new MediaService();
