import { z } from 'zod';

export const uploadMediaDto = z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    date: z.string().datetime().optional(),
    linkedPersonId: z.string().optional(),
    linkedEventType: z.string().optional(),
});

export const approveMediaDto = z.object({
    // intentionally empty — action is in the route
});

export type UploadMediaDto = z.infer<typeof uploadMediaDto>;
